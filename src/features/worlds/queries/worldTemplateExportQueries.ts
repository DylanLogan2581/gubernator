import { requireSupabaseClient } from "@/lib/supabase";
import type { GubernatorSupabaseClient } from "@/lib/supabase";
import type { WorldTemplate } from "@/shared/worldTemplateSchema";

export class WorldTemplateExportError extends Error {
  readonly code: string;
  readonly worldId: string;

  constructor({
    code,
    message,
    worldId,
  }: {
    readonly code: string;
    readonly message: string;
    readonly worldId: string;
  }) {
    super(message);
    this.name = "WorldTemplateExportError";
    this.code = code;
    this.worldId = worldId;
  }
}

type ExportResponse =
  | { readonly ok: true; readonly data: WorldTemplate }
  | {
      readonly ok: false;
      readonly error: { readonly code: string; readonly message: string };
    };

function isExportResponse(value: unknown): value is ExportResponse {
  if (value === null || typeof value !== "object") return false;
  if (
    !("ok" in value) ||
    typeof (value as Record<string, unknown>).ok !== "boolean"
  )
    return false;
  return true;
}

export async function exportWorldTemplate(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<WorldTemplate> {
  const response = await client.functions.invoke<unknown>(
    "export-world-template",
    {
      body: { worldId },
    },
  );

  if (response.error !== null) {
    // Try to parse a structured error from the response body
    let parsedError: { code: string; message: string } | null = null;
    try {
      const text = await (
        response.error as { context?: { text?: () => Promise<string> } }
      ).context?.text?.();
      if (text !== undefined) {
        const parsed: unknown = JSON.parse(text);
        if (
          parsed !== null &&
          typeof parsed === "object" &&
          "error" in parsed &&
          typeof (parsed as Record<string, unknown>).error === "object"
        ) {
          const err = (
            parsed as Record<string, { code?: string; message?: string }>
          ).error;
          if (typeof err.code === "string" && typeof err.message === "string") {
            parsedError = { code: err.code, message: err.message };
          }
        }
      }
    } catch {
      // ignore parse errors
    }

    throw new WorldTemplateExportError({
      code: parsedError?.code ?? "export_failed",
      message: parsedError?.message ?? "World template export failed.",
      worldId,
    });
  }

  if (!isExportResponse(response.data)) {
    throw new WorldTemplateExportError({
      code: "invalid_response",
      message: "World template export returned an invalid response.",
      worldId,
    });
  }

  if (!response.data.ok) {
    throw new WorldTemplateExportError({
      code: response.data.error.code,
      message: response.data.error.message,
      worldId,
    });
  }

  return response.data.data;
}

export function serializeWorldTemplate(template: WorldTemplate): string {
  return JSON.stringify(template, null, 2);
}

export function exportWorldTemplateMutationOptions(worldId: string): {
  mutationFn: () => Promise<WorldTemplate>;
} {
  return {
    mutationFn: () => exportWorldTemplate(requireSupabaseClient(), worldId),
  };
}
