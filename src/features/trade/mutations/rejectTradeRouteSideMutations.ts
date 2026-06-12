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

import { tradeRoutesQueryKeys } from "../queries/tradeRoutesQueryKeys";
import {
  rejectTradeRouteSideInputSchema,
  type RejectTradeRouteSideInput,
} from "../schemas/rejectTradeRouteSideSchemas";

import type { RejectTradeRouteSideResult } from "../types/tradeRouteTypes";
import type { z } from "zod";

type RejectTradeRouteSideMutationErrorCode =
  | "reject_trade_route_side_citizen_wrong_nation"
  | "reject_trade_route_side_input_invalid"
  | "reject_trade_route_side_invalid_status"
  | "reject_trade_route_side_not_authorized"
  | "reject_trade_route_side_not_found"
  | "reject_trade_route_side_values_invalid";

export type RejectTradeRouteSideMutationIssue = MutationIssue;

export const {
  ErrorClass: RejectTradeRouteSideMutationError,
  isError: isRejectTradeRouteSideMutationError,
} = createMutationError<RejectTradeRouteSideMutationErrorCode>(
  "RejectTradeRouteSideMutationError",
);
export type RejectTradeRouteSideMutationError = InstanceType<
  typeof RejectTradeRouteSideMutationError
>;

type RejectTradeRouteSideMutationOptions = UseMutationOptions<
  RejectTradeRouteSideResult,
  Error,
  RejectTradeRouteSideInput
>;

export function rejectTradeRouteSideMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RejectTradeRouteSideMutationOptions {
  return mutationOptions({
    mutationFn: (input: RejectTradeRouteSideInput) =>
      rejectTradeRouteSide(client, input),
    mutationKey: [...tradeRoutesQueryKeys.all, "reject-trade-route-side"],
    onSuccess: async (result): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: tradeRoutesQueryKeys.forSettlement(
            result.originSettlementId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: tradeRoutesQueryKeys.forSettlement(
            result.destinationSettlementId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: ["forecast"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["forecast"],
        }),
      ]);
    },
  });
}

async function rejectTradeRouteSide(
  client: GubernatorSupabaseClient,
  input: RejectTradeRouteSideInput,
): Promise<RejectTradeRouteSideResult> {
  const values = parseInput(rejectTradeRouteSideInputSchema, input);

  const { data, error } = await client
    .rpc("reject_trade_route_side", {
      p_rejector_citizen_id: values.rejectorCitizenId,
      p_route_id: values.tradeRouteId,
      p_side: values.side,
    })
    .maybeSingle<{
      readonly destination_settlement_id: string;
      readonly id: string;
      readonly origin_settlement_id: string;
      readonly status: string;
    }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new RejectTradeRouteSideMutationError({
        code: "reject_trade_route_side_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0001") {
      if (error.message.includes("side nation")) {
        throw new RejectTradeRouteSideMutationError({
          code: "reject_trade_route_side_citizen_wrong_nation",
          message: "Rejector citizen does not belong to the side nation.",
        });
      }
      if (error.message.includes("current status")) {
        throw new RejectTradeRouteSideMutationError({
          code: "reject_trade_route_side_invalid_status",
          message: "Trade route cannot be rejected in its current status.",
        });
      }
      throw new RejectTradeRouteSideMutationError({
        code: "reject_trade_route_side_values_invalid",
        message: error.message,
      });
    }
    if (error.code === "P0002") {
      throw new RejectTradeRouteSideMutationError({
        code: "reject_trade_route_side_not_found",
        message: "Trade route or rejector citizen not found.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new RejectTradeRouteSideMutationError({
      code: "reject_trade_route_side_not_found",
      message: "Trade route could not be rejected.",
    });
  }

  return {
    destinationSettlementId: data.destination_settlement_id,
    originSettlementId: data.origin_settlement_id,
    status: data.status as RejectTradeRouteSideResult["status"],
    tradeRouteId: data.id,
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
      new RejectTradeRouteSideMutationError({
        code: "reject_trade_route_side_input_invalid",
        issues,
        message: "Trade route rejection input is invalid.",
      }),
  );
}
