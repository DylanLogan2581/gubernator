import { describe, expect, it } from "vitest";

import {
  computeCoverCropRect,
  WORLD_HERO_TARGET,
  WORLD_THUMBNAIL_TARGET,
} from "./worldImageProcessing";

describe("computeCoverCropRect", () => {
  it("crops the sides off a wider-than-target source", () => {
    expect(computeCoverCropRect(2000, 1000, WORLD_THUMBNAIL_TARGET)).toEqual({
      sHeight: 1000,
      sWidth: 1000,
      sx: 500,
      sy: 0,
    });
  });

  it("crops the top/bottom off a taller-than-target source", () => {
    expect(computeCoverCropRect(1000, 2000, WORLD_THUMBNAIL_TARGET)).toEqual({
      sHeight: 1000,
      sWidth: 1000,
      sx: 0,
      sy: 500,
    });
  });

  it("returns the full frame when the source aspect ratio already matches", () => {
    expect(computeCoverCropRect(256, 256, WORLD_THUMBNAIL_TARGET)).toEqual({
      sHeight: 256,
      sWidth: 256,
      sx: 0,
      sy: 0,
    });
  });

  it("crops a square source down to the wide hero aspect ratio", () => {
    expect(computeCoverCropRect(1000, 1000, WORLD_HERO_TARGET)).toEqual({
      sHeight: 250,
      sWidth: 1000,
      sx: 0,
      sy: 375,
    });
  });
});
