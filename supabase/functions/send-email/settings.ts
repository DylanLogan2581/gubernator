import { supabaseFetch } from "../_shared/supabaseFetch.ts";

import type { UpdateSmtpSettingsRequestBody } from "./types.ts";

export type ServiceRoleConfig = {
  readonly supabaseUrl: string;
  readonly serviceRoleKey: string;
};

export type SmtpSettingsRow = {
  readonly host: string;
  readonly port: number;
  readonly username: string | null;
  readonly password: string | null;
  readonly admin_email: string;
  readonly sender_name: string;
};

export type ResolvedSmtpConfig = {
  readonly source: "database" | "environment";
  readonly host: string;
  readonly port: number;
  readonly user?: string;
  readonly pass?: string;
  readonly adminEmail: string;
  readonly senderName: string;
};

/**
 * Reads the single-row smtp_settings table via the service_role key (the
 * only client permitted by RLS). Returns null when no row has been saved
 * yet, so callers fall back to env-based configuration.
 */
export async function fetchSmtpSettingsRow(
  config: ServiceRoleConfig,
): Promise<SmtpSettingsRow | null> {
  const select = "host,port,username,password,admin_email,sender_name";
  let response: Response;
  try {
    response = await supabaseFetch(
      `${config.supabaseUrl}/rest/v1/smtp_settings?select=${select}&id=eq.true`,
      {
        headers: {
          apikey: config.serviceRoleKey,
          authorization: `Bearer ${config.serviceRoleKey}`,
        },
        method: "GET",
      },
    );
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return null;
  }

  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  return payload[0] as SmtpSettingsRow;
}

/**
 * Upserts the single smtp_settings row. A blank/omitted password preserves
 * the previously stored value instead of clearing it.
 */
export async function upsertSmtpSettings(
  config: ServiceRoleConfig,
  input: UpdateSmtpSettingsRequestBody,
  updatedByUserId: string,
): Promise<{ readonly ok: boolean }> {
  const existing = input.password === undefined || input.password === ""
    ? await fetchSmtpSettingsRow(config)
    : null;
  const password = input.password === undefined || input.password === ""
    ? existing?.password ?? null
    : input.password;

  let response: Response;
  try {
    response = await supabaseFetch(
      `${config.supabaseUrl}/rest/v1/smtp_settings?on_conflict=id`,
      {
        body: JSON.stringify({
          admin_email: input.adminEmail,
          host: input.host,
          id: true,
          password,
          port: input.port,
          sender_name: input.senderName,
          updated_at: new Date().toISOString(),
          updated_by: updatedByUserId,
          username: input.username ?? null,
        }),
        headers: {
          apikey: config.serviceRoleKey,
          authorization: `Bearer ${config.serviceRoleKey}`,
          "content-type": "application/json",
          prefer: "resolution=merge-duplicates",
        },
        method: "POST",
      },
    );
  } catch {
    return { ok: false };
  }

  return { ok: response.ok };
}

function nonEmptyStringOrUndefined(value: string | null | undefined): string | undefined {
  return value !== null && value !== undefined && value.length > 0 ? value : undefined;
}

/**
 * Resolves the active SMTP config: a saved DB row wins whole-row when
 * present (issue #1234), otherwise falls back to the env vars unchanged.
 */
export async function resolveSmtpConfig(
  config: ServiceRoleConfig,
  envConfig: () => { readonly ok: true; readonly value: Omit<ResolvedSmtpConfig, "source"> } | {
    readonly ok: false;
    readonly missing: readonly string[];
  },
): Promise<
  | { readonly ok: true; readonly value: ResolvedSmtpConfig }
  | { readonly ok: false; readonly missing: readonly string[] }
> {
  const row = await fetchSmtpSettingsRow(config);
  if (row !== null) {
    return {
      ok: true,
      value: {
        adminEmail: row.admin_email,
        host: row.host,
        pass: nonEmptyStringOrUndefined(row.password),
        port: row.port,
        senderName: row.sender_name,
        source: "database",
        user: nonEmptyStringOrUndefined(row.username),
      },
    };
  }

  const envResult = envConfig();
  if (!envResult.ok) {
    return envResult;
  }

  return { ok: true, value: { ...envResult.value, source: "environment" } };
}
