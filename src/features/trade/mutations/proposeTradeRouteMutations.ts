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
  proposeTradeRouteInputSchema,
  type ProposeTradeRouteInput,
} from "../schemas/proposeTradeRouteSchemas";

import type { ProposeTradeRouteResult } from "../types/tradeRouteTypes";
import type { z } from "zod";

type ProposeTradeRouteMutationErrorCode =
  | "propose_trade_route_citizen_wrong_nation"
  | "propose_trade_route_input_invalid"
  | "propose_trade_route_not_authorized"
  | "propose_trade_route_not_found"
  | "propose_trade_route_resource_trashed"
  | "propose_trade_route_values_invalid";

export type ProposeTradeRouteMutationIssue = MutationIssue;

export const {
  ErrorClass: ProposeTradeRouteMutationError,
  isError: isProposeTradeRouteMutationError,
} = createMutationError<ProposeTradeRouteMutationErrorCode>(
  "ProposeTradeRouteMutationError",
);
export type ProposeTradeRouteMutationError = InstanceType<
  typeof ProposeTradeRouteMutationError
>;

type ProposeTradeRouteMutationOptions = UseMutationOptions<
  ProposeTradeRouteResult,
  Error,
  ProposeTradeRouteInput
>;

export function proposeTradeRouteMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): ProposeTradeRouteMutationOptions {
  return mutationOptions({
    mutationFn: (input: ProposeTradeRouteInput) =>
      proposeTradeRoute(client, input),
    mutationKey: [...tradeRoutesQueryKeys.all, "propose-trade-route"],
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

async function proposeTradeRoute(
  client: GubernatorSupabaseClient,
  input: ProposeTradeRouteInput,
): Promise<ProposeTradeRouteResult> {
  const values = parseInput(proposeTradeRouteInputSchema, input);

  const { data, error } = await client
    .rpc("propose_trade_route", {
      p_destination: values.destinationSettlementId,
      p_legs: values.legs.map((leg) => ({
        direction: leg.direction,
        quantity: leg.quantity,
        resource_id: leg.resourceId,
      })),
      p_origin: values.originSettlementId,
      p_proposed_by_citizen_id: values.proposingCitizenId,
    })
    .maybeSingle<{
      readonly destination_settlement_id: string;
      readonly id: string;
      readonly origin_settlement_id: string;
    }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new ProposeTradeRouteMutationError({
        code: "propose_trade_route_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0001") {
      if (error.message.includes("trashed")) {
        throw new ProposeTradeRouteMutationError({
          code: "propose_trade_route_resource_trashed",
          message: "Resource is trashed.",
        });
      }
      if (error.message.includes("endpoint nation")) {
        throw new ProposeTradeRouteMutationError({
          code: "propose_trade_route_citizen_wrong_nation",
          message: "Proposing citizen must belong to an endpoint nation.",
        });
      }
      throw new ProposeTradeRouteMutationError({
        code: "propose_trade_route_values_invalid",
        message: error.message,
      });
    }
    if (error.code === "P0002") {
      throw new ProposeTradeRouteMutationError({
        code: "propose_trade_route_not_found",
        message: "Settlement, resource, or citizen not found.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ProposeTradeRouteMutationError({
      code: "propose_trade_route_not_found",
      message: "Trade route could not be created.",
    });
  }

  return {
    destinationSettlementId: data.destination_settlement_id,
    originSettlementId: data.origin_settlement_id,
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
      new ProposeTradeRouteMutationError({
        code: "propose_trade_route_input_invalid",
        issues,
        message: "Trade route proposal input is invalid.",
      }),
  );
}
