import { describe, expect, it } from "vitest";

import {
  breakTreatyInputSchema,
  proposeTreatyInputSchema,
  respondToTreatyInputSchema,
  withdrawTreatyInputSchema,
} from "./treatiesSchemas";

const PROPOSER_NATION_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const RESPONDER_NATION_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const TREATY_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const CITIZEN_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const CITIZEN_B_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const RESOURCE_ID = "11111111-1111-1111-1111-111111111111";

describe("proposeTreatyInputSchema", () => {
  it("accepts a valid tribute proposal", () => {
    const result = proposeTreatyInputSchema.safeParse({
      proposedByCitizenId: CITIZEN_ID,
      proposerNationId: PROPOSER_NATION_ID,
      responderNationId: RESPONDER_NATION_ID,
      terms: {
        payer: "proposer",
        quantityPerTurn: 20,
        resourceId: RESOURCE_ID,
      },
      treatyType: "tribute",
    });

    expect(result.success).toBe(true);
  });

  it("rejects tribute with a non-positive quantity", () => {
    const result = proposeTreatyInputSchema.safeParse({
      proposedByCitizenId: CITIZEN_ID,
      proposerNationId: PROPOSER_NATION_ID,
      responderNationId: RESPONDER_NATION_ID,
      terms: { payer: "proposer", quantityPerTurn: 0, resourceId: RESOURCE_ID },
      treatyType: "tribute",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a valid trade_agreement proposal with empty terms", () => {
    const result = proposeTreatyInputSchema.safeParse({
      proposedByCitizenId: CITIZEN_ID,
      proposerNationId: PROPOSER_NATION_ID,
      responderNationId: RESPONDER_NATION_ID,
      terms: {},
      treatyType: "trade_agreement",
    });

    expect(result.success).toBe(true);
  });

  it("rejects trade_agreement terms with extra fields", () => {
    const result = proposeTreatyInputSchema.safeParse({
      proposedByCitizenId: CITIZEN_ID,
      proposerNationId: PROPOSER_NATION_ID,
      responderNationId: RESPONDER_NATION_ID,
      terms: { durationTurns: 10 },
      treatyType: "trade_agreement",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a valid royal_marriage proposal", () => {
    const result = proposeTreatyInputSchema.safeParse({
      proposedByCitizenId: CITIZEN_ID,
      proposerNationId: PROPOSER_NATION_ID,
      responderNationId: RESPONDER_NATION_ID,
      terms: { citizenAId: CITIZEN_ID, citizenBId: CITIZEN_B_ID },
      treatyType: "royal_marriage",
    });

    expect(result.success).toBe(true);
  });

  it("rejects royal_marriage with two identical citizens", () => {
    const result = proposeTreatyInputSchema.safeParse({
      proposedByCitizenId: CITIZEN_ID,
      proposerNationId: PROPOSER_NATION_ID,
      responderNationId: RESPONDER_NATION_ID,
      terms: { citizenAId: CITIZEN_ID, citizenBId: CITIZEN_ID },
      treatyType: "royal_marriage",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unsupported treaty type", () => {
    const result = proposeTreatyInputSchema.safeParse({
      proposedByCitizenId: CITIZEN_ID,
      proposerNationId: PROPOSER_NATION_ID,
      responderNationId: RESPONDER_NATION_ID,
      terms: {},
      treatyType: "currency_exchange",
    });

    expect(result.success).toBe(false);
  });
});

describe("respondToTreatyInputSchema", () => {
  it("accepts accept and decline responses", () => {
    expect(
      respondToTreatyInputSchema.safeParse({
        respondedByCitizenId: CITIZEN_ID,
        response: "accept",
        treatyId: TREATY_ID,
      }).success,
    ).toBe(true);
    expect(
      respondToTreatyInputSchema.safeParse({
        respondedByCitizenId: CITIZEN_ID,
        response: "decline",
        treatyId: TREATY_ID,
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid response value", () => {
    const result = respondToTreatyInputSchema.safeParse({
      respondedByCitizenId: CITIZEN_ID,
      response: "maybe",
      treatyId: TREATY_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("withdrawTreatyInputSchema", () => {
  it("accepts a valid treaty id", () => {
    expect(
      withdrawTreatyInputSchema.safeParse({ treatyId: TREATY_ID }).success,
    ).toBe(true);
  });
});

describe("breakTreatyInputSchema", () => {
  it("accepts a valid treaty id and acting citizen", () => {
    expect(
      breakTreatyInputSchema.safeParse({
        brokenByCitizenId: CITIZEN_ID,
        treatyId: TREATY_ID,
      }).success,
    ).toBe(true);
  });
});
