import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError } from "@/features/auth";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { buildingsQueryKeys } from "../queries/buildingsQueryKeys";
import {
  resumeConstructionProjectInputSchema,
  type ResumeConstructionProjectInput,
} from "../schemas/resumeConstructionProjectSchemas";

import type { ResumeConstructionProjectResult } from "../types/constructionProjectTypes";
import type { z } from "zod";

type ResumeConstructionProjectMutationErrorCode =
  | "resume_construction_project_input_invalid"
  | "resume_construction_project_not_authorized"
  | "resume_construction_project_not_found"
  | "resume_construction_project_not_cancelled";

export type ResumeConstructionProjectMutationIssue = MutationIssue;

export const {
  ErrorClass: ResumeConstructionProjectMutationError,
  isError: isResumeConstructionProjectMutationError,
} = createMutationError<ResumeConstructionProjectMutationErrorCode>(
  "ResumeConstructionProjectMutationError",
);
export type ResumeConstructionProjectMutationError = InstanceType<
  typeof ResumeConstructionProjectMutationError
>;

type ResumeConstructionProjectMutationOptions = UseMutationOptions<
  ResumeConstructionProjectResult,
  Error,
  ResumeConstructionProjectInput
>;

export function resumeConstructionProjectMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
  settlementId,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): ResumeConstructionProjectMutationOptions {
  return mutationOptions({
    mutationFn: (input: ResumeConstructionProjectInput) =>
      resumeConstructionProject(client, input),
    mutationKey: [...buildingsQueryKeys.all, "resume-construction-project"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey:
          buildingsQueryKeys.constructionProjectsBySettlement(settlementId),
      });
    },
  });
}

async function resumeConstructionProject(
  client: GubernatorSupabaseClient,
  input: ResumeConstructionProjectInput,
): Promise<ResumeConstructionProjectResult> {
  const values = parseInput(resumeConstructionProjectInputSchema, input);

  const { data, error } = await client
    .rpc("resume_construction_project", {
      p_project_id: values.projectId,
    })
    .maybeSingle<{
      readonly project_id: string;
      readonly success: boolean;
    }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new ResumeConstructionProjectMutationError({
        code: "resume_construction_project_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0002") {
      throw new ResumeConstructionProjectMutationError({
        code: "resume_construction_project_not_found",
        message: "Construction project not found.",
      });
    }
    if (error.code === "P0001") {
      throw new ResumeConstructionProjectMutationError({
        code: "resume_construction_project_not_cancelled",
        message: "Construction project is not cancelled.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ResumeConstructionProjectMutationError({
      code: "resume_construction_project_not_found",
      message: "Construction project not found.",
    });
  }

  return {
    projectId: data.project_id,
    success: data.success,
  };
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new ResumeConstructionProjectMutationError({
        code: "resume_construction_project_input_invalid",
        issues,
        message: "Resume construction project input is invalid.",
      }),
  );
}
