import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  enrollCitizenMutationOptions,
  isEnrollCitizenMutationError,
  isUnenrollCitizenMutationError,
  unenrollCitizenMutationOptions,
} from "./educationEnrollmentMutations";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const SETTLEMENT_BUILDING_ID = "22222222-2222-2222-2222-222222222222";
const CITIZEN_ID = "33333333-3333-3333-3333-333333333333";
const ENROLLMENT_ID = "44444444-4444-4444-4444-444444444444";

type SupabaseError = { readonly code?: string; readonly message: string };
type RpcRow = { readonly id: string };
type SupabaseResult<T> =
  | { readonly data: readonly T[]; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError };

function createRpcClient(result: SupabaseResult<RpcRow>): {
  readonly client: GubernatorSupabaseClient;
  readonly calls: { readonly rpc: ReturnType<typeof vi.fn> };
} {
  const returns = vi.fn().mockResolvedValue(result);
  const rpc = vi.fn(() => ({ returns }));
  return {
    client: { rpc } as unknown as GubernatorSupabaseClient,
    calls: { rpc },
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
}

function executeMutation<TOptions extends { mutationFn?: unknown }>(
  queryClient: QueryClient,
  options: TOptions,
  variables: unknown,
): Promise<unknown> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options as never)
    .execute(variables);
}

describe("enrollCitizenMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = enrollCitizenMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
    });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: "not-a-uuid",
        settlementBuildingId: SETTLEMENT_BUILDING_ID,
      }),
    ).rejects.toSatisfy(isEnrollCitizenMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls enroll_citizen RPC and returns the enrollment id", async () => {
    const { client, calls } = createRpcClient({
      data: [{ id: ENROLLMENT_ID }],
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = enrollCitizenMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
    });

    const result = await executeMutation(queryClient, options, {
      citizenId: CITIZEN_ID,
      settlementBuildingId: SETTLEMENT_BUILDING_ID,
    });

    expect(result).toEqual({ enrollmentId: ENROLLMENT_ID });
    expect(calls.rpc).toHaveBeenCalledWith("enroll_citizen", {
      p_citizen_id: CITIZEN_ID,
      p_settlement_building_id: SETTLEMENT_BUILDING_ID,
    });
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("translates a P0001 error into a friendly rejection message", async () => {
    const { client } = createRpcClient({
      data: null,
      error: {
        code: "P0001",
        message: "settlement building is at student capacity",
      },
    });
    const queryClient = createQueryClient();
    const options = enrollCitizenMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
    });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: CITIZEN_ID,
        settlementBuildingId: SETTLEMENT_BUILDING_ID,
      }),
    ).rejects.toMatchObject({
      code: "enroll_citizen_rejected",
      message: "settlement building is at student capacity",
    });
  });

  it("translates a 42501 error into a forbidden rejection", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "forbidden" },
    });
    const queryClient = createQueryClient();
    const options = enrollCitizenMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
    });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: CITIZEN_ID,
        settlementBuildingId: SETTLEMENT_BUILDING_ID,
      }),
    ).rejects.toMatchObject({ code: "enroll_citizen_forbidden" });
  });
});

describe("unenrollCitizenMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = unenrollCitizenMutationOptions({
      client,
      queryClient,
      settlementBuildingId: SETTLEMENT_BUILDING_ID,
      settlementId: SETTLEMENT_ID,
    });

    await expect(
      executeMutation(queryClient, options, { enrollmentId: "not-a-uuid" }),
    ).rejects.toSatisfy(isUnenrollCitizenMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls unenroll_citizen RPC and returns the enrollment id", async () => {
    const { client, calls } = createRpcClient({
      data: [{ id: ENROLLMENT_ID }],
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = unenrollCitizenMutationOptions({
      client,
      queryClient,
      settlementBuildingId: SETTLEMENT_BUILDING_ID,
      settlementId: SETTLEMENT_ID,
    });

    const result = await executeMutation(queryClient, options, {
      enrollmentId: ENROLLMENT_ID,
    });

    expect(result).toEqual({ enrollmentId: ENROLLMENT_ID });
    expect(calls.rpc).toHaveBeenCalledWith("unenroll_citizen", {
      p_enrollment_id: ENROLLMENT_ID,
    });
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("raises unenroll_citizen_not_found when the RPC returns no row", async () => {
    const { client } = createRpcClient({ data: [], error: null });
    const queryClient = createQueryClient();
    const options = unenrollCitizenMutationOptions({
      client,
      queryClient,
      settlementBuildingId: SETTLEMENT_BUILDING_ID,
      settlementId: SETTLEMENT_ID,
    });

    await expect(
      executeMutation(queryClient, options, { enrollmentId: ENROLLMENT_ID }),
    ).rejects.toMatchObject({ code: "unenroll_citizen_not_found" });
  });
});
