import { describe, expect, it } from "vitest";

import {
  downscaleImageToBlob,
  NATION_FLAG_TARGET,
  NationImageProcessingError,
} from "./nationImageProcessing";

describe("NATION_FLAG_TARGET", () => {
  it("pins the nation flag dimensions", () => {
    expect(NATION_FLAG_TARGET).toEqual({ height: 200, width: 300 });
  });
});

describe("downscaleImageToBlob", () => {
  it("throws a NationImageProcessingError with a nation-scoped code", async () => {
    const file = new File(["not an image"], "notes.txt", {
      type: "text/plain",
    });

    const promise = downscaleImageToBlob(file, NATION_FLAG_TARGET);
    await expect(promise).rejects.toBeInstanceOf(NationImageProcessingError);
    await expect(promise).rejects.toMatchObject({
      code: "nation_image_invalid_type",
    });
  });
});
