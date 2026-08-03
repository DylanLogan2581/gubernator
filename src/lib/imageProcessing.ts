// Client-side image downscale/crop shared by the nation and world image
// upload flows — oversized uploads never hit the network at full resolution;
// the storage buckets' file_size_limit is a backstop, not the primary control
// (#1008, #1072). Feature modules wrap this with their own error types and
// target dimensions.

const OUTPUT_MIME_TYPE = "image/webp";
const OUTPUT_QUALITY = 0.85;

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

export type ImageProcessingErrorKind =
  | "decode_failed"
  | "encode_failed"
  | "invalid_type";

export type ImageProcessingOptions = {
  // Builds the feature-specific error to throw (e.g. NationImageProcessingError).
  readonly createError: (
    kind: ImageProcessingErrorKind,
    message: string,
  ) => Error;
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
  options: ImageProcessingOptions,
): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw options.createError(
      "invalid_type",
      "Only image files can be uploaded.",
    );
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw options.createError(
      "decode_failed",
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
      throw options.createError(
        "encode_failed",
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
      throw options.createError(
        "encode_failed",
        "The image could not be processed.",
      );
    }

    return blob;
  } finally {
    bitmap.close();
  }
}
