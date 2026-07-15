import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { smtpStatusQueryOptions } from "./superadminQueries";

describe("smtpStatusQueryOptions", () => {
  it("returns SMTP status on success", async () => {
    const client = createClient({
      data: {
        data: { configured: false, missing: ["SEND_EMAIL_SMTP_HOST"] },
        ok: true,
      },
      error: null,
    });
    const queryClient = createQueryClient();

    const status = await queryClient.fetchQuery(smtpStatusQueryOptions(client));

    expect(status).toEqual({
      configured: false,
      missing: ["SEND_EMAIL_SMTP_HOST"],
    });
  });

  it("throws friendly copy when the edge runtime is unreachable via a fetch error", async () => {
    const client = createClient({
      data: null,
      error: new FunctionsFetchError(new Error("network down")),
    });
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(smtpStatusQueryOptions(client)),
    ).rejects.toThrow(
      "Couldn't reach the email service. If running locally, make sure Supabase edge functions are being served.",
    );
  });

  it("throws friendly copy when the relay cannot reach the function", async () => {
    const client = createClient({
      data: null,
      error: new FunctionsRelayError({ region: "any" }),
    });
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(smtpStatusQueryOptions(client)),
    ).rejects.toThrow(
      "Couldn't reach the email service. If running locally, make sure Supabase edge functions are being served.",
    );
  });

  it("throws friendly copy for a gateway-level non-2xx status (e.g. Kong 503)", async () => {
    const client = createClient({
      data: null,
      error: new FunctionsHttpError(new Response(null, { status: 503 })),
    });
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(smtpStatusQueryOptions(client)),
    ).rejects.toThrow(
      "Couldn't reach the email service. If running locally, make sure Supabase edge functions are being served.",
    );
  });

  it("preserves the original message for a non-gateway non-2xx status", async () => {
    const client = createClient({
      data: null,
      error: new FunctionsHttpError(new Response(null, { status: 403 })),
    });
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(smtpStatusQueryOptions(client)),
    ).rejects.toThrow("Edge Function returned a non-2xx status code");
  });
});

function createClient(response: {
  readonly data: unknown;
  readonly error: unknown;
}): GubernatorSupabaseClient {
  return {
    functions: {
      invoke: () => Promise.resolve(response),
    },
  } as unknown as GubernatorSupabaseClient;
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}
