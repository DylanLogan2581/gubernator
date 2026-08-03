import { describe, expect, it } from "vitest";

import {
  downscaleImageToBlob,
  WORLD_HERO_TARGET,
  WORLD_THUMBNAIL_TARGET,
  WorldImageProcessingError,
} from "./worldImageProcessing";

describe("world image targets", () => {
  it("pins the thumbnail dimensions", () => {
    expect(WORLD_THUMBNAIL_TARGET).toEqual({ height: 256, width: 256 });
  });

  it("pins the hero dimensions", () => {
    expect(WORLD_HERO_TARGET).toEqual({ height: 400, width: 1600 });
  });
});

describe("downscaleImageToBlob", () => {
  it("throws a WorldImageProcessingError with a world-scoped code", async () => {
    const file = new File(["not an image"], "notes.txt", {
      type: "text/plain",
    });

    const promise = downscaleImageToBlob(file, WORLD_THUMBNAIL_TARGET);
    await expect(promise).rejects.toBeInstanceOf(WorldImageProcessingError);
    await expect(promise).rejects.toMatchObject({
      code: "world_image_invalid_type",
    });
  });
});
