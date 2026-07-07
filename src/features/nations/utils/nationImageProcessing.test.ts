import { describe, expect, it } from "vitest";

import {
  computeCoverCropRect,
  NATION_FLAG_TARGET,
} from "./nationImageProcessing";

describe("computeCoverCropRect", () => {
  it("crops the sides off a wider-than-target source", () => {
    expect(computeCoverCropRect(2000, 1000, NATION_FLAG_TARGET)).toEqual({
      sHeight: 1000,
      sWidth: 1500,
      sx: 250,
      sy: 0,
    });
  });

  it("crops the top/bottom off a taller-than-target source", () => {
    const rect = computeCoverCropRect(1000, 1000, NATION_FLAG_TARGET);
    expect(rect.sWidth).toBe(1000);
    expect(rect.sx).toBe(0);
    expect(rect.sHeight).toBeCloseTo(666.667, 2);
    expect(rect.sy).toBeCloseTo(166.667, 2);
  });

  it("returns the full frame when the source aspect ratio already matches", () => {
    expect(computeCoverCropRect(300, 200, NATION_FLAG_TARGET)).toEqual({
      sHeight: 200,
      sWidth: 300,
      sx: 0,
      sy: 0,
    });
  });
});
