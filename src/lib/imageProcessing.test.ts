import { describe, expect, it } from "vitest";

import { computeCoverCropRect, downscaleImageToBlob } from "./imageProcessing";

describe("computeCoverCropRect", () => {
  it("crops the sides off a wider-than-target source", () => {
    expect(
      computeCoverCropRect(2000, 1000, { height: 200, width: 300 }),
    ).toEqual({
      sHeight: 1000,
      sWidth: 1500,
      sx: 250,
      sy: 0,
    });
  });

  it("crops the sides off a wider-than-square source for a square target", () => {
    expect(
      computeCoverCropRect(2000, 1000, { height: 256, width: 256 }),
    ).toEqual({
      sHeight: 1000,
      sWidth: 1000,
      sx: 500,
      sy: 0,
    });
  });

  it("crops the top/bottom off a taller-than-target source", () => {
    expect(
      computeCoverCropRect(1000, 2000, { height: 256, width: 256 }),
    ).toEqual({
      sHeight: 1000,
      sWidth: 1000,
      sx: 0,
      sy: 500,
    });
  });

  it("crops the top/bottom off a square source for a wide target", () => {
    const rect = computeCoverCropRect(1000, 1000, { height: 200, width: 300 });
    expect(rect.sWidth).toBe(1000);
    expect(rect.sx).toBe(0);
    expect(rect.sHeight).toBeCloseTo(666.667, 2);
    expect(rect.sy).toBeCloseTo(166.667, 2);
  });

  it("crops a square source down to a very wide aspect ratio", () => {
    expect(
      computeCoverCropRect(1000, 1000, { height: 400, width: 1600 }),
    ).toEqual({
      sHeight: 250,
      sWidth: 1000,
      sx: 0,
      sy: 375,
    });
  });

  it("returns the full frame when the source aspect ratio already matches", () => {
    expect(computeCoverCropRect(300, 200, { height: 200, width: 300 })).toEqual(
      {
        sHeight: 200,
        sWidth: 300,
        sx: 0,
        sy: 0,
      },
    );
  });
});

describe("downscaleImageToBlob", () => {
  it("rejects non-image files with the caller's invalid_type error", async () => {
    const file = new File(["not an image"], "notes.txt", {
      type: "text/plain",
    });

    await expect(
      downscaleImageToBlob(
        file,
        { height: 200, width: 300 },
        {
          createError: (kind, message) => new Error(`${kind}: ${message}`),
        },
      ),
    ).rejects.toThrow("invalid_type: Only image files can be uploaded.");
  });
});
