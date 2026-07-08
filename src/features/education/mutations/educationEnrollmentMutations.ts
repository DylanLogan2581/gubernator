import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError } from "@/features/auth";
import { citizensQueryKeys } from "@/features/citizens";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { educationEnrollmentsQueryKeys } from "../queries/educationEnrollmentsQueryKeys";
import {
  enrollCitizenInputSchema,
  unenrollCitizenInputSchema,
  type EnrollCitizenInput,
  type UnenrollCitizenInput,
} from "../schemas/educationEnrollmentSchemas";

import type {
  EnrollCitizenResult,
  UnenrollCitizenResult,
} from "../types/educationEnrollmentTypes";
import type { z } from "zod";

type EnrollCitizenMutationErrorCode =
  | "enroll_citizen_forbidden"
  | "enroll_citizen_input_invalid"
  | "enroll_citizen_not_found"
  | "enroll_citizen_rejected";

export type EnrollCitizenMutationIssue = MutationIssue;

export const {
  ErrorClass: EnrollCitizenMutationError,
  isError: isEnrollCitizenMutationError,
} = createMutationError<EnrollCitizenMutationErrorCode>(
  "EnrollCitizenMutationError",
);
export type EnrollCitizenMutationError = InstanceType<
  typeof EnrollCitizenMutationError
>;

type UnenrollCitizenMutationErrorCode =
  | "unenroll_citizen_forbidden"
  | "unenroll_citizen_input_invalid"
  | "unenroll_citizen_not_found";

export type UnenrollCitizenMutationIssue = MutationIssue;

export const {
  ErrorClass: UnenrollCitizenMutationError,
  isError: isUnenrollCitizenMutationError,
} = createMutationError<UnenrollCitizenMutationErrorCode>(
  "UnenrollCitizenMutationError",
);
export type UnenrollCitizenMutationError = InstanceType<
  typeof UnenrollCitizenMutationError
>;

type EnrollCitizenMutationOptions = UseMutationOptions<
  EnrollCitizenResult,
  Error,
  EnrollCitizenInput
>;

export function enrollCitizenMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
  settlementId,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): EnrollCitizenMutationOptions {
  return mutationOptions({
    mutationFn: (input: EnrollCitizenInput) => enrollCitizen(client, input),
    mutationKey: [...educationEnrollmentsQueryKeys.all, "enroll-citizen"],
    onSuccess: async (_result, input): Promise<void> => {
      const values = parseEnrollInput(input);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: educationEnrollmentsQueryKeys.bySchool(
            values.settlementBuildingId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: educationEnrollmentsQueryKeys.bySettlement(settlementId),
        }),
        queryClient.invalidateQueries({
          queryKey: citizensQueryKeys.assignmentsInSettlement(settlementId),
        }),
        queryClient.invalidateQueries({
          queryKey: citizensQueryKeys.settlementTargetAssignments(settlementId),
        }),
      ]);
    },
  });
}

function parseEnrollInput(
  input: unknown,
): z.output<typeof enrollCitizenInputSchema> {
  return parseMutationInput(
    enrollCitizenInputSchema,
    input,
    (issues) =>
      new EnrollCitizenMutationError({
        code: "enroll_citizen_input_invalid",
        issues,
        message: "Enroll citizen input is invalid.",
      }),
  );
}

async function enrollCitizen(
  client: GubernatorSupabaseClient,
  input: EnrollCitizenInput,
): Promise<EnrollCitizenResult> {
  const values = parseEnrollInput(input);

  const { data, error } = await client
    .rpc("enroll_citizen", {
      p_citizen_id: values.citizenId,
      p_settlement_building_id: values.settlementBuildingId,
    })
    .returns<{ readonly id: string }[]>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new EnrollCitizenMutationError({
        code: "enroll_citizen_forbidden",
        message: "You do not have permission to manage this settlement.",
      });
    }
    if (error.code === "P0002") {
      throw new EnrollCitizenMutationError({
        code: "enroll_citizen_not_found",
        message: "School or citizen not found.",
      });
    }
    if (error.code === "P0001") {
      throw new EnrollCitizenMutationError({
        code: "enroll_citizen_rejected",
        message: error.message,
      });
    }
    throw normalizeSupabaseError(error);
  }

  const enrollment = data?.[0];
  if (enrollment === undefined) {
    throw new EnrollCitizenMutationError({
      code: "enroll_citizen_not_found",
      message: "Enrollment could not be created.",
    });
  }

  return { enrollmentId: enrollment.id };
}

type UnenrollCitizenMutationOptions = UseMutationOptions<
  UnenrollCitizenResult,
  Error,
  UnenrollCitizenInput
>;

export function unenrollCitizenMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
  settlementBuildingId,
  settlementId,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
  readonly settlementBuildingId: string;
  readonly settlementId: string;
}): UnenrollCitizenMutationOptions {
  return mutationOptions({
    mutationFn: (input: UnenrollCitizenInput) => unenrollCitizen(client, input),
    mutationKey: [...educationEnrollmentsQueryKeys.all, "unenroll-citizen"],
    onSuccess: async (): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey:
            educationEnrollmentsQueryKeys.bySchool(settlementBuildingId),
        }),
        queryClient.invalidateQueries({
          queryKey: educationEnrollmentsQueryKeys.bySettlement(settlementId),
        }),
        queryClient.invalidateQueries({
          queryKey: citizensQueryKeys.assignmentsInSettlement(settlementId),
        }),
        queryClient.invalidateQueries({
          queryKey: citizensQueryKeys.settlementTargetAssignments(settlementId),
        }),
      ]);
    },
  });
}

async function unenrollCitizen(
  client: GubernatorSupabaseClient,
  input: UnenrollCitizenInput,
): Promise<UnenrollCitizenResult> {
  const values = parseMutationInput(
    unenrollCitizenInputSchema,
    input,
    (issues) =>
      new UnenrollCitizenMutationError({
        code: "unenroll_citizen_input_invalid",
        issues,
        message: "Unenroll citizen input is invalid.",
      }),
  );

  const { data, error } = await client
    .rpc("unenroll_citizen", { p_enrollment_id: values.enrollmentId })
    .returns<{ readonly id: string }[]>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new UnenrollCitizenMutationError({
        code: "unenroll_citizen_forbidden",
        message: "You do not have permission to manage this settlement.",
      });
    }
    if (error.code === "P0002") {
      throw new UnenrollCitizenMutationError({
        code: "unenroll_citizen_not_found",
        message: "Enrollment not found.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  const enrollment = data?.[0];
  if (enrollment === undefined) {
    throw new UnenrollCitizenMutationError({
      code: "unenroll_citizen_not_found",
      message: "Enrollment not found.",
    });
  }

  return { enrollmentId: enrollment.id };
}
