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
  replaceTradeRouteInputSchema,
  type ReplaceTradeRouteInput,
} from "../schemas/replaceTradeRouteSchemas";

import type { ReplaceTradeRouteResult } from "../types/tradeRouteTypes";
import type { z } from "zod";

type ReplaceTradeRouteMutationErrorCode =
  | "replace_trade_route_citizen_wrong_nation"
  | "replace_trade_route_input_invalid"
  | "replace_trade_route_invalid_status"
  | "replace_trade_route_not_authorized"
  | "replace_trade_route_not_found"
  | "replace_trade_route_resource_trashed"
  | "replace_trade_route_values_invalid";

export type ReplaceTradeRouteMutationIssue = MutationIssue;

export const {
  ErrorClass: ReplaceTradeRouteMutationError,
  isError: isReplaceTradeRouteMutationError,
} = createMutationError<ReplaceTradeRouteMutationErrorCode>(
  "ReplaceTradeRouteMutationError",
);
export type ReplaceTradeRouteMutationError = InstanceType<
  typeof ReplaceTradeRouteMutationError
>;

type ReplaceTradeRouteMutationOptions = UseMutationOptions<
  ReplaceTradeRouteResult,
  Error,
  ReplaceTradeRouteInput
>;

export function replaceTradeRouteMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): ReplaceTradeRouteMutationOptions {
  return mutationOptions({
    mutationFn: (input: ReplaceTradeRouteInput) =>
      replaceTradeRoute(client, input),
    mutationKey: [...tradeRoutesQueryKeys.all, "replace-trade-route"],
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

async function replaceTradeRoute(
  client: GubernatorSupabaseClient,
  input: ReplaceTradeRouteInput,
): Promise<ReplaceTradeRouteResult> {
  const values = parseInput(replaceTradeRouteInputSchema, input);

  const { data, error } = await client
    .rpc("replace_trade_route", {
      p_new_payload: {
        destination_settlement_id:
          values.newRoutePayload.destinationSettlementId,
        legs: values.newRoutePayload.legs,
        origin_settlement_id: values.newRoutePayload.originSettlementId,
      },
      p_old_id: values.oldRouteId,
      p_proposing_citizen_id: values.proposingCitizenId,
    })
    .maybeSingle<{
      readonly destination_settlement_id: string;
      readonly new_route_id: string;
      readonly old_route_id: string;
      readonly origin_settlement_id: string;
    }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new ReplaceTradeRouteMutationError({
        code: "replace_trade_route_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0001") {
      if (error.message.includes("current status")) {
        throw new ReplaceTradeRouteMutationError({
          code: "replace_trade_route_invalid_status",
          message: "Trade route cannot be replaced in its current status.",
        });
      }
      if (error.message.includes("trashed")) {
        throw new ReplaceTradeRouteMutationError({
          code: "replace_trade_route_resource_trashed",
          message: "Resource is trashed.",
        });
      }
      if (error.message.includes("endpoint nation")) {
        throw new ReplaceTradeRouteMutationError({
          code: "replace_trade_route_citizen_wrong_nation",
          message: "Proposing citizen must belong to an endpoint nation.",
        });
      }
      throw new ReplaceTradeRouteMutationError({
        code: "replace_trade_route_values_invalid",
        message: error.message,
      });
    }
    if (error.code === "P0002") {
      throw new ReplaceTradeRouteMutationError({
        code: "replace_trade_route_not_found",
        message: "Trade route, settlement, resource, or citizen not found.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ReplaceTradeRouteMutationError({
      code: "replace_trade_route_not_found",
      message: "Trade route could not be replaced.",
    });
  }

  return {
    destinationSettlementId: data.destination_settlement_id,
    newTradeRouteId: data.new_route_id,
    oldTradeRouteId: data.old_route_id,
    originSettlementId: data.origin_settlement_id,
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
      new ReplaceTradeRouteMutationError({
        code: "replace_trade_route_input_invalid",
        issues,
        message: "Trade route replacement input is invalid.",
      }),
  );
}
