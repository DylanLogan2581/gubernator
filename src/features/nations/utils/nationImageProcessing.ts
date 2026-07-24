// Client-side downscale/crop so oversized uploads never hit the network at
// full resolution — the nation-images bucket's file_size_limit is a backstop,
// not the primary control (#1072). Thin config wrapper around the shared
// logic in @/lib/imageProcessing.
import {
  downscaleImageToBlob as downscaleImageToBlobShared,
  type ImageProcessingErrorKind,
  type ImageTargetSize,
} from "@/lib/imageProcessing";

export { computeCoverCropRect } from "@/lib/imageProcessing";
export type { CoverCropRect, ImageTargetSize } from "@/lib/imageProcessing";

export const NATION_FLAG_TARGET = { height: 200, width: 300 } as const;

export type NationImageProcessingErrorCode =
  | "nation_image_decode_failed"
  | "nation_image_encode_failed"
  | "nation_image_invalid_type";

export class NationImageProcessingError extends Error {
  readonly code: NationImageProcessingErrorCode;

  constructor(code: NationImageProcessingErrorCode, message: string) {
    super(message);
    this.name = "NationImageProcessingError";
    this.code = code;
  }
}

const ERROR_CODE_BY_KIND = {
  decode_failed: "nation_image_decode_failed",
  encode_failed: "nation_image_encode_failed",
  invalid_type: "nation_image_invalid_type",
} as const satisfies Record<
  ImageProcessingErrorKind,
  NationImageProcessingErrorCode
>;

export async function downscaleImageToBlob(
  file: File,
  target: ImageTargetSize,
): Promise<Blob> {
  return downscaleImageToBlobShared(file, target, {
    createError: (kind, message) =>
      new NationImageProcessingError(ERROR_CODE_BY_KIND[kind], message),
  });
}
