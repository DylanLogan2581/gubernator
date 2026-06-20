import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError } from "@/features/auth";
import { createMutationError } from "@/lib/mutationError";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import type { WorldTemplate } from "@/shared/worldTemplateSchema";
import type { Json } from "@/types/database";

import { worldQueryKeys } from "../queries/worldQueryKeys";

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------
type WorldTemplateImportErrorCode =
  | "template_import_not_authorized"
  | "template_import_invalid"
  | "template_import_failed";

export const {
  ErrorClass: WorldTemplateImportError,
  isError: isWorldTemplateImportError,
} = createMutationError<WorldTemplateImportErrorCode>(
  "WorldTemplateImportError",
);
export type WorldTemplateImportError = InstanceType<
  typeof WorldTemplateImportError
>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type WorldRow = {
  readonly id: string;
  readonly name: string;
  readonly visibility: string;
  readonly status: string;
  readonly current_turn_number: number;
  readonly is_trashed: boolean;
  readonly archived_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

export type ImportWorldFromTemplateInput = {
  readonly name: string;
  readonly visibility: "public" | "private";
  readonly template: WorldTemplate;
};

type MutationFactoryOpts = {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
};

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------
async function importWorldFromTemplate(
  client: GubernatorSupabaseClient,
  input: ImportWorldFromTemplateInput,
): Promise<WorldRow> {
  const { data, error } = await client
    .rpc("import_world_from_template", {
      p_name: input.name.trim(),
      p_visibility: input.visibility,
      // Pass the template as Json; the runtime value is a plain JSON object.
      p_template: input.template as unknown as Json,
    })
    .maybeSingle<WorldRow>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new WorldTemplateImportError({
        code: "template_import_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "22000") {
      throw new WorldTemplateImportError({
        code: "template_import_invalid",
        message: error.message,
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new WorldTemplateImportError({
      code: "template_import_failed",
      message: "World could not be created from template.",
    });
  }

  return data;
}

// ---------------------------------------------------------------------------
// Options factory
// ---------------------------------------------------------------------------
export function importWorldFromTemplateMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  WorldRow,
  Error,
  ImportWorldFromTemplateInput
> {
  return mutationOptions({
    mutationFn: (input: ImportWorldFromTemplateInput) =>
      importWorldFromTemplate(client, input),
    mutationKey: [...worldQueryKeys.all, "import-world-from-template"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: worldQueryKeys.all });
    },
  });
}
