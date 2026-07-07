/**
 * Minimal SMTP client for privileged edge functions, built on raw Deno TCP
 * sockets. No external dependency: this repo's edge functions use only
 * explicit relative `.ts` imports (see deno.json / AGENTS.md), so a small
 * hand-rolled client is preferred over introducing a third-party SMTP
 * library and its transitive dependency surface.
 *
 * Supports plaintext (local dev / Inbucket), STARTTLS upgrade when the
 * server advertises it, and optional AUTH LOGIN when credentials are
 * provided. One connection is reused across a batch of messages.
 */

// This repo has no ambient Deno type declarations (see _shared/http/env.ts,
// which declares only the minimal `EdgeRuntime` shape it needs). Follow the
// same pattern here rather than pulling in @types/deno for the whole repo.
type SmtpConn = {
  read(buffer: Uint8Array): Promise<number | null>;
  write(buffer: Uint8Array): Promise<number>;
  close(): void;
};

type SmtpCapableDeno = {
  connect(options: { readonly hostname: string; readonly port: number }): Promise<SmtpConn>;
  startTls(conn: SmtpConn, options: { readonly hostname: string }): Promise<SmtpConn>;
};

declare const Deno: SmtpCapableDeno;

export type SmtpConfig = {
  readonly host: string;
  readonly port: number;
  readonly user?: string;
  readonly pass?: string;
};

export type SmtpMessage = {
  readonly fromEmail: string;
  readonly fromName: string;
  readonly toEmail: string;
  readonly subject: string;
  readonly html: string;
};

export type SmtpSendResult =
  | { readonly ok: true; readonly toEmail: string }
  | { readonly ok: false; readonly toEmail: string; readonly error: string };

type SmtpResponse = { readonly code: number; readonly text: string };

class SmtpProtocolError extends Error {}

function base64Encode(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

async function readResponse(conn: SmtpConn): Promise<SmtpResponse> {
  const decoder = new TextDecoder();
  let buffer = "";
  const chunk = new Uint8Array(4096);

  for (;;) {
    const n = await conn.read(chunk);
    if (n === null) {
      throw new SmtpProtocolError("SMTP connection closed unexpectedly");
    }
    buffer += decoder.decode(chunk.subarray(0, n), { stream: true });

    const lines = buffer.split("\r\n").filter((line) => line.length > 0);
    if (lines.length === 0) continue;

    const lastLine = lines[lines.length - 1];
    // A response is complete once the last line has "CODE " (space, not dash)
    // after the 3-digit status code.
    if (/^\d{3} /.test(lastLine)) {
      const code = Number.parseInt(lastLine.slice(0, 3), 10);
      return { code, text: lines.join("\n") };
    }
  }
}

async function sendCommand(conn: SmtpConn, command: string): Promise<SmtpResponse> {
  await conn.write(new TextEncoder().encode(`${command}\r\n`));
  return readResponse(conn);
}

function assertCode(response: SmtpResponse, expected: readonly number[], step: string): void {
  if (!expected.includes(response.code)) {
    throw new SmtpProtocolError(
      `SMTP ${step} failed: ${response.code} ${response.text}`,
    );
  }
}

function upgradeToTls(conn: SmtpConn, host: string): Promise<SmtpConn> {
  return Deno.startTls(conn, { hostname: host });
}

function buildDataPayload(message: SmtpMessage): string {
  const headers = [
    `From: ${message.fromName} <${message.fromEmail}>`,
    `To: ${message.toEmail}`,
    `Subject: ${message.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
  ].join("\r\n");

  // Dot-stuff any line that starts with a lone "." so it is not mistaken for
  // the end-of-data marker.
  const escapedBody = message.html.replace(/\r\n\./g, "\r\n..");

  return `${headers}\r\n\r\n${escapedBody}\r\n.`;
}

/**
 * Sends a batch of messages over a single SMTP connection. Each message is
 * attempted independently: a failure on one recipient does not abort the
 * remaining sends. Returns one result per input message, in order.
 */
export async function sendSmtpBatch(
  config: SmtpConfig,
  messages: readonly SmtpMessage[],
): Promise<readonly SmtpSendResult[]> {
  if (messages.length === 0) {
    return [];
  }

  let conn: SmtpConn = await Deno.connect({ hostname: config.host, port: config.port });

  try {
    const greeting = await readResponse(conn);
    assertCode(greeting, [220], "greeting");

    let ehlo = await sendCommand(conn, `EHLO gubernator.local`);
    assertCode(ehlo, [250], "EHLO");

    if (ehlo.text.toUpperCase().includes("STARTTLS")) {
      const startTls = await sendCommand(conn, "STARTTLS");
      assertCode(startTls, [220], "STARTTLS");
      conn = await upgradeToTls(conn, config.host);
      ehlo = await sendCommand(conn, `EHLO gubernator.local`);
      assertCode(ehlo, [250], "EHLO after STARTTLS");
    }

    if (config.user !== undefined && config.user.length > 0 && config.pass !== undefined) {
      const authStart = await sendCommand(conn, "AUTH LOGIN");
      assertCode(authStart, [334], "AUTH LOGIN");
      const userStep = await sendCommand(conn, base64Encode(config.user));
      assertCode(userStep, [334], "AUTH LOGIN username");
      const passStep = await sendCommand(conn, base64Encode(config.pass));
      assertCode(passStep, [235], "AUTH LOGIN password");
    }

    const results: SmtpSendResult[] = [];

    for (const message of messages) {
      try {
        const mailFrom = await sendCommand(conn, `MAIL FROM:<${message.fromEmail}>`);
        assertCode(mailFrom, [250], "MAIL FROM");

        const rcptTo = await sendCommand(conn, `RCPT TO:<${message.toEmail}>`);
        assertCode(rcptTo, [250, 251], "RCPT TO");

        const dataStart = await sendCommand(conn, "DATA");
        assertCode(dataStart, [354], "DATA");

        const dataEnd = await sendCommand(conn, buildDataPayload(message));
        assertCode(dataEnd, [250], "end of DATA");

        results.push({ ok: true, toEmail: message.toEmail });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({ ok: false, toEmail: message.toEmail, error: errorMessage });
      }
    }

    await sendCommand(conn, "QUIT").catch(() => undefined);

    return results;
  } finally {
    try {
      conn.close();
    } catch {
      // Connection may already be closed after QUIT; ignore.
    }
  }
}
