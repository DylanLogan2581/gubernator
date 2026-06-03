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
  cancelTradeRouteInputSchema,
  type CancelTradeRouteInput,
} from "../schemas/cancelTradeRouteSchemas";

import type { CancelTradeRouteResult } from "../types/tradeRouteTypes";
import type { z } from "zod";

type CancelTradeRouteMutationErrorCode =
  | "cancel_trade_route_input_invalid"
  | "cancel_trade_route_invalid_status"
  | "cancel_trade_route_not_authorized"
  | "cancel_trade_route_not_found"
  | "cancel_trade_route_values_invalid";

export type CancelTradeRouteMutationIssue = MutationIssue;

export const {
  ErrorClass: CancelTradeRouteMutationError,
  isError: isCancelTradeRouteMutationError,
} = createMutationError<CancelTradeRouteMutationErrorCode>(
  "CancelTradeRouteMutationError",
);
export type CancelTradeRouteMutationError = InstanceType<
  typeof CancelTradeRouteMutationError
>;

type CancelTradeRouteMutationOptions = UseMutationOptions<
  CancelTradeRouteResult,
  Error,
  CancelTradeRouteInput
>;

export function cancelTradeRouteMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CancelTradeRouteMutationOptions {
  return mutationOptions({
    mutationFn: (input: CancelTradeRouteInput) =>
      cancelTradeRoute(client, input),
    mutationKey: [...tradeRoutesQueryKeys.all, "cancel-trade-route"],
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

async function cancelTradeRoute(
  client: GubernatorSupabaseClient,
  input: CancelTradeRouteInput,
): Promise<CancelTradeRouteResult> {
  const values = parseInput(cancelTradeRouteInputSchema, input);

  const { data, error } = await client
    .rpc("cancel_trade_route", {
      p_route_id: values.tradeRouteId,
    })
    .maybeSingle<{
      readonly destination_settlement_id: string;
      readonly id: string;
      readonly origin_settlement_id: string;
      readonly status: string;
    }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new CancelTradeRouteMutationError({
        code: "cancel_trade_route_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0001") {
      if (error.message.includes("current status")) {
        throw new CancelTradeRouteMutationError({
          code: "cancel_trade_route_invalid_status",
          message: "Trade route cannot be cancelled in its current status.",
        });
      }
      throw new CancelTradeRouteMutationError({
        code: "cancel_trade_route_values_invalid",
        message: error.message,
      });
    }
    if (error.code === "P0002") {
      throw new CancelTradeRouteMutationError({
        code: "cancel_trade_route_not_found",
        message: "Trade route not found.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new CancelTradeRouteMutationError({
      code: "cancel_trade_route_not_found",
      message: "Trade route could not be cancelled.",
    });
  }

  return {
    destinationSettlementId: data.destination_settlement_id,
    originSettlementId: data.origin_settlement_id,
    status: data.status as CancelTradeRouteResult["status"],
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
      new CancelTradeRouteMutationError({
        code: "cancel_trade_route_input_invalid",
        issues,
        message: "Trade route cancellation input is invalid.",
      }),
  );
}
