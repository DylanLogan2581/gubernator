import { isRecord } from "../_shared/http/guards.ts";
import { supabaseFetch } from "../_shared/supabaseFetch.ts";

import type { EmailRecipient, SendEmailRequestBody } from "./types.ts";

export const MAX_RECIPIENTS = 500;

const REST_ID_BATCH_SIZE = 100;

export type RecipientResolutionResult =
  | { readonly ok: true; readonly recipients: readonly EmailRecipient[] }
  | {
    readonly ok: false;
    readonly code: "no_recipients" | "recipient_resolution_failed" | "too_many_recipients";
    readonly message: string;
  };

type ServiceRoleConfig = {
  readonly supabaseUrl: string;
  readonly serviceRoleKey: string;
};

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function inFilter(values: readonly string[]): string {
  return `in.(${values.map((value) => encodeURIComponent(value)).join(",")})`;
}

async function restGet(config: ServiceRoleConfig, path: string): Promise<unknown> {
  const response = await supabaseFetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": "application/json",
    },
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`REST request failed: ${path} -> ${response.status}`);
  }

  return response.json();
}

function toUserIdRows(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected an array of rows");
  }
  const ids: string[] = [];
  for (const row of value) {
    if (isRecord(row) && typeof row["user_id"] === "string") {
      ids.push(row["user_id"]);
    }
  }
  return ids;
}

function toRecipientRows(value: unknown): readonly EmailRecipient[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected an array of rows");
  }
  const recipients: EmailRecipient[] = [];
  for (const row of value) {
    if (isRecord(row) && typeof row["id"] === "string" && typeof row["email"] === "string") {
      recipients.push({ email: row["email"], userId: row["id"] });
    }
  }
  return recipients;
}

async function fetchActiveUsersByIds(
  config: ServiceRoleConfig,
  userIds: readonly string[],
): Promise<readonly EmailRecipient[]> {
  const uniqueIds = [...new Set(userIds)];
  const recipients: EmailRecipient[] = [];

  for (const batch of chunk(uniqueIds, REST_ID_BATCH_SIZE)) {
    const rows = await restGet(
      config,
      `users?select=id,email&status=eq.active&id=${inFilter(batch)}`,
    );
    recipients.push(...toRecipientRows(rows));
  }

  return recipients;
}

async function fetchAllActiveUsers(
  config: ServiceRoleConfig,
): Promise<{ readonly recipients: readonly EmailRecipient[]; readonly overflowed: boolean }> {
  const rows = await restGet(
    config,
    `users?select=id,email&status=eq.active&order=id.asc&limit=${MAX_RECIPIENTS + 1}`,
  );
  const recipients = toRecipientRows(rows);
  return { overflowed: recipients.length > MAX_RECIPIENTS, recipients };
}

async function fetchWorldMemberUserIds(
  config: ServiceRoleConfig,
  worldId: string,
): Promise<readonly string[]> {
  const rows = await restGet(
    config,
    `citizens?select=user_id&world_id=eq.${encodeURIComponent(worldId)}&citizen_type=eq.player_character&status=eq.alive&user_id=not.is.null`,
  );
  return [...new Set(toUserIdRows(rows))];
}

async function fetchNationMemberUserIds(
  config: ServiceRoleConfig,
  nationId: string,
): Promise<readonly string[]> {
  const settlementRows = await restGet(
    config,
    `settlements?select=id&nation_id=eq.${encodeURIComponent(nationId)}`,
  );

  const settlementIds: string[] = [];
  if (Array.isArray(settlementRows)) {
    for (const row of settlementRows) {
      if (isRecord(row) && typeof row["id"] === "string") {
        settlementIds.push(row["id"]);
      }
    }
  }

  if (settlementIds.length === 0) {
    return [];
  }

  const userIds = new Set<string>();
  for (const batch of chunk(settlementIds, REST_ID_BATCH_SIZE)) {
    const rows = await restGet(
      config,
      `citizens?select=user_id&settlement_id=${inFilter(batch)}&citizen_type=eq.player_character&status=eq.alive&user_id=not.is.null`,
    );
    for (const userId of toUserIdRows(rows)) {
      userIds.add(userId);
    }
  }

  return [...userIds];
}

/**
 * Resolves the recipient list for a manual send (kind !== "test") using the
 * service-role key, bypassing RLS by design: recipient resolution is a
 * privileged operation performed entirely server-side, never trusting a
 * client-supplied recipient list beyond the "specific" case's user ids.
 */
export async function resolveRecipients(
  config: ServiceRoleConfig,
  body: SendEmailRequestBody,
): Promise<RecipientResolutionResult> {
  try {
    let recipients: readonly EmailRecipient[];

    switch (body.kind) {
      case "all": {
        const result = await fetchAllActiveUsers(config);
        if (result.overflowed) {
          return {
            code: "too_many_recipients",
            message:
              `This send would reach more than ${MAX_RECIPIENTS} recipients. Narrow the ` +
              `recipient scope (e.g. by world or nation) and try again.`,
            ok: false,
          };
        }
        recipients = result.recipients;
        break;
      }
      case "specific": {
        recipients = await fetchActiveUsersByIds(config, body.userIds ?? []);
        break;
      }
      case "world": {
        const userIds = await fetchWorldMemberUserIds(config, body.worldId ?? "");
        if (userIds.length > MAX_RECIPIENTS) {
          return {
            code: "too_many_recipients",
            message: `This world has more than ${MAX_RECIPIENTS} members. Narrow the recipient scope and try again.`,
            ok: false,
          };
        }
        recipients = await fetchActiveUsersByIds(config, userIds);
        break;
      }
      case "nation": {
        const userIds = await fetchNationMemberUserIds(config, body.nationId ?? "");
        if (userIds.length > MAX_RECIPIENTS) {
          return {
            code: "too_many_recipients",
            message: `This nation has more than ${MAX_RECIPIENTS} members. Narrow the recipient scope and try again.`,
            ok: false,
          };
        }
        recipients = await fetchActiveUsersByIds(config, userIds);
        break;
      }
      case "test": {
        // Test sends are resolved separately (the caller's own account), not
        // through this bulk recipient-resolution path.
        recipients = [];
        break;
      }
    }

    if (recipients.length === 0) {
      return {
        code: "no_recipients",
        message: "No active recipients matched the selected scope.",
        ok: false,
      };
    }

    if (recipients.length > MAX_RECIPIENTS) {
      return {
        code: "too_many_recipients",
        message: `This send would reach more than ${MAX_RECIPIENTS} recipients. Narrow the recipient scope and try again.`,
        ok: false,
      };
    }

    return { ok: true, recipients };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-restricted-syntax
    console.log(
      JSON.stringify({
        error: errorMessage,
        event: "recipient_resolution_error",
        kind: body.kind,
        timestamp: new Date().toISOString(),
      }),
    );
    return {
      code: "recipient_resolution_failed",
      message: "Failed to resolve recipients for this send.",
      ok: false,
    };
  }
}

export async function fetchCallerRecipient(
  config: ServiceRoleConfig,
  userId: string,
): Promise<EmailRecipient | null> {
  const rows = await restGet(
    config,
    `users?select=id,email&id=eq.${encodeURIComponent(userId)}`,
  );
  const recipients = toRecipientRows(rows);
  return recipients[0] ?? null;
}
