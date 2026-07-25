import { describe, expect, it } from "vitest";

import {
  downscaleImageToBlob,
  SETTLEMENT_FLAG_TARGET,
  SETTLEMENT_SEAL_TARGET,
  SettlementImageProcessingError,
} from "./settlementImageProcessing";

describe("settlement image targets", () => {
  it("pins the settlement flag dimensions", () => {
    expect(SETTLEMENT_FLAG_TARGET).toEqual({ height: 200, width: 300 });
  });

  it("pins the settlement seal dimensions to a square", () => {
    expect(SETTLEMENT_SEAL_TARGET).toEqual({ height: 300, width: 300 });
  });
});

describe("downscaleImageToBlob", () => {
  it("throws a SettlementImageProcessingError with a settlement-scoped code", async () => {
    const file = new File(["not an image"], "notes.txt", {
      type: "text/plain",
    });

    const promise = downscaleImageToBlob(file, SETTLEMENT_FLAG_TARGET);
    await expect(promise).rejects.toBeInstanceOf(
      SettlementImageProcessingError,
    );
    await expect(promise).rejects.toMatchObject({
      code: "settlement_image_invalid_type",
    });
  });
});
