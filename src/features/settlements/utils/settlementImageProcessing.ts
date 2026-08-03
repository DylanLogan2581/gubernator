// Client-side downscale/crop so oversized uploads never hit the network at
// full resolution — the settlement-images bucket's file_size_limit is a
// backstop, not the primary control (#1373). Thin config wrapper around the
// shared logic in @/lib/imageProcessing, mirroring nationImageProcessing.ts.
import {
  downscaleImageToBlob as downscaleImageToBlobShared,
  type ImageProcessingErrorKind,
  type ImageTargetSize,
} from "@/lib/imageProcessing";

export type { ImageTargetSize } from "@/lib/imageProcessing";

// Match the nation flag/seal dimensions so settlement imagery downscales
// identically (#1373).
export const SETTLEMENT_FLAG_TARGET = { height: 200, width: 300 } as const;
export const SETTLEMENT_SEAL_TARGET = { height: 300, width: 300 } as const;

export type SettlementImageProcessingErrorCode =
  | "settlement_image_decode_failed"
  | "settlement_image_encode_failed"
  | "settlement_image_invalid_type";

export class SettlementImageProcessingError extends Error {
  readonly code: SettlementImageProcessingErrorCode;

  constructor(code: SettlementImageProcessingErrorCode, message: string) {
    super(message);
    this.name = "SettlementImageProcessingError";
    this.code = code;
  }
}

const ERROR_CODE_BY_KIND = {
  decode_failed: "settlement_image_decode_failed",
  encode_failed: "settlement_image_encode_failed",
  invalid_type: "settlement_image_invalid_type",
} as const satisfies Record<
  ImageProcessingErrorKind,
  SettlementImageProcessingErrorCode
>;

export async function downscaleImageToBlob(
  file: File,
  target: ImageTargetSize,
): Promise<Blob> {
  return downscaleImageToBlobShared(file, target, {
    createError: (kind, message) =>
      new SettlementImageProcessingError(ERROR_CODE_BY_KIND[kind], message),
  });
}
