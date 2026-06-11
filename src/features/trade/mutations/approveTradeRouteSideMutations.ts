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
  approveTradeRouteSideInputSchema,
  type ApproveTradeRouteSideInput,
} from "../schemas/approveTradeRouteSideSchemas";

import type { ApproveTradeRouteSideResult } from "../types/tradeRouteTypes";
import type { z } from "zod";

type ApproveTradeRouteSideMutationErrorCode =
  | "approve_trade_route_side_already_approved"
  | "approve_trade_route_side_citizen_wrong_nation"
  | "approve_trade_route_side_input_invalid"
  | "approve_trade_route_side_invalid_status"
  | "approve_trade_route_side_not_authorized"
  | "approve_trade_route_side_not_found"
  | "approve_trade_route_side_values_invalid";

export type ApproveTradeRouteSideMutationIssue = MutationIssue;

export const {
  ErrorClass: ApproveTradeRouteSideMutationError,
  isError: isApproveTradeRouteSideMutationError,
} = createMutationError<ApproveTradeRouteSideMutationErrorCode>(
  "ApproveTradeRouteSideMutationError",
);
export type ApproveTradeRouteSideMutationError = InstanceType<
  typeof ApproveTradeRouteSideMutationError
>;

type ApproveTradeRouteSideMutationOptions = UseMutationOptions<
  ApproveTradeRouteSideResult,
  Error,
  ApproveTradeRouteSideInput
>;

export function approveTradeRouteSideMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): ApproveTradeRouteSideMutationOptions {
  return mutationOptions({
    mutationFn: (input: ApproveTradeRouteSideInput) =>
      approveTradeRouteSide(client, input),
    mutationKey: [...tradeRoutesQueryKeys.all, "approve-trade-route-side"],
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
      ]);
    },
  });
}

async function approveTradeRouteSide(
  client: GubernatorSupabaseClient,
  input: ApproveTradeRouteSideInput,
): Promise<ApproveTradeRouteSideResult> {
  const values = parseInput(approveTradeRouteSideInputSchema, input);

  const { data, error } = await client
    .rpc("approve_trade_route_side", {
      p_approver_citizen_id: values.approverCitizenId,
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
      throw new ApproveTradeRouteSideMutationError({
        code: "approve_trade_route_side_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0001") {
      if (error.message.includes("already approved")) {
        throw new ApproveTradeRouteSideMutationError({
          code: "approve_trade_route_side_already_approved",
          message: "This side of the trade route is already approved.",
        });
      }
      if (
        error.message.includes("side nation") ||
        (error.message.includes("citizen") && error.message.includes("nation"))
      ) {
        throw new ApproveTradeRouteSideMutationError({
          code: "approve_trade_route_side_citizen_wrong_nation",
          message: "Approver citizen does not belong to the side nation.",
        });
      }
      if (error.message.includes("current status")) {
        throw new ApproveTradeRouteSideMutationError({
          code: "approve_trade_route_side_invalid_status",
          message: "Trade route cannot be approved in its current status.",
        });
      }
      throw new ApproveTradeRouteSideMutationError({
        code: "approve_trade_route_side_values_invalid",
        message: error.message,
      });
    }
    if (error.code === "P0002") {
      throw new ApproveTradeRouteSideMutationError({
        code: "approve_trade_route_side_not_found",
        message: "Trade route or approver citizen not found.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ApproveTradeRouteSideMutationError({
      code: "approve_trade_route_side_not_found",
      message: "Trade route could not be approved.",
    });
  }

  return {
    destinationSettlementId: data.destination_settlement_id,
    originSettlementId: data.origin_settlement_id,
    status: data.status as ApproveTradeRouteSideResult["status"],
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
      new ApproveTradeRouteSideMutationError({
        code: "approve_trade_route_side_input_invalid",
        issues,
        message: "Trade route approval input is invalid.",
      }),
  );
}
