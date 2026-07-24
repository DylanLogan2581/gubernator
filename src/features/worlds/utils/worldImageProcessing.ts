// Client-side downscale/crop so oversized uploads never hit the network at
// full resolution — the world-images bucket's file_size_limit is a backstop,
// not the primary control (#1008). Thin config wrapper around the shared
// logic in @/lib/imageProcessing.
import {
  downscaleImageToBlob as downscaleImageToBlobShared,
  type ImageProcessingErrorKind,
  type ImageTargetSize,
} from "@/lib/imageProcessing";

export { computeCoverCropRect } from "@/lib/imageProcessing";
export type { CoverCropRect, ImageTargetSize } from "@/lib/imageProcessing";

export const WORLD_THUMBNAIL_TARGET = { height: 256, width: 256 } as const;
export const WORLD_HERO_TARGET = { height: 400, width: 1600 } as const;

export type WorldImageProcessingErrorCode =
  | "world_image_decode_failed"
  | "world_image_encode_failed"
  | "world_image_invalid_type";

export class WorldImageProcessingError extends Error {
  readonly code: WorldImageProcessingErrorCode;

  constructor(code: WorldImageProcessingErrorCode, message: string) {
    super(message);
    this.name = "WorldImageProcessingError";
    this.code = code;
  }
}

const ERROR_CODE_BY_KIND = {
  decode_failed: "world_image_decode_failed",
  encode_failed: "world_image_encode_failed",
  invalid_type: "world_image_invalid_type",
} as const satisfies Record<
  ImageProcessingErrorKind,
  WorldImageProcessingErrorCode
>;

export async function downscaleImageToBlob(
  file: File,
  target: ImageTargetSize,
): Promise<Blob> {
  return downscaleImageToBlobShared(file, target, {
    createError: (kind, message) =>
      new WorldImageProcessingError(ERROR_CODE_BY_KIND[kind], message),
  });
}
