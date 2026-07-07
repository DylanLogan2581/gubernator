// Client-side downscale/crop so oversized uploads never hit the network at
// full resolution — the world-images bucket's file_size_limit is a backstop,
// not the primary control (#1008).
export const WORLD_THUMBNAIL_TARGET = { height: 256, width: 256 } as const;
export const WORLD_HERO_TARGET = { height: 400, width: 1600 } as const;

const OUTPUT_MIME_TYPE = "image/webp";
const OUTPUT_QUALITY = 0.85;

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

export type ImageTargetSize = {
  readonly height: number;
  readonly width: number;
};

export type CoverCropRect = {
  readonly sHeight: number;
  readonly sWidth: number;
  readonly sx: number;
  readonly sy: number;
};

// Pure math: the largest centered rectangle within a sourceWidth x
// sourceHeight image whose aspect ratio matches target, i.e. a "cover" crop.
export function computeCoverCropRect(
  sourceWidth: number,
  sourceHeight: number,
  target: ImageTargetSize,
): CoverCropRect {
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = target.width / target.height;

  if (sourceAspect > targetAspect) {
    const sWidth = sourceHeight * targetAspect;
    return {
      sHeight: sourceHeight,
      sWidth,
      sx: (sourceWidth - sWidth) / 2,
      sy: 0,
    };
  }

  const sHeight = sourceWidth / targetAspect;
  return {
    sHeight,
    sWidth: sourceWidth,
    sx: 0,
    sy: (sourceHeight - sHeight) / 2,
  };
}

// Validates, center-crops, and downscales an uploaded image file to an exact
// target size, returning a webp blob ready to upload. Runs entirely in the
// browser (canvas + createImageBitmap) — never sends the original file.
export async function downscaleImageToBlob(
  file: File,
  target: ImageTargetSize,
): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new WorldImageProcessingError(
      "world_image_invalid_type",
      "Only image files can be uploaded.",
    );
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new WorldImageProcessingError(
      "world_image_decode_failed",
      "That image could not be read. Try a different file.",
    );
  }

  try {
    const crop = computeCoverCropRect(bitmap.width, bitmap.height, target);
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d");

    if (context === null) {
      throw new WorldImageProcessingError(
        "world_image_encode_failed",
        "This browser cannot process images.",
      );
    }

    context.drawImage(
      bitmap,
      crop.sx,
      crop.sy,
      crop.sWidth,
      crop.sHeight,
      0,
      0,
      target.width,
      target.height,
    );

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, OUTPUT_MIME_TYPE, OUTPUT_QUALITY);
    });

    if (blob === null) {
      throw new WorldImageProcessingError(
        "world_image_encode_failed",
        "The image could not be processed.",
      );
    }

    return blob;
  } finally {
    bitmap.close();
  }
}
