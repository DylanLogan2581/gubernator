import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageUp, Trash2 } from "lucide-react";
import { useRef, useState, type ChangeEvent, type JSX } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  removeWorldImageMutationOptions,
  uploadWorldImageMutationOptions,
  type WorldImageKind,
} from "../mutations/worldImageMutations";
import { worldImagesQueryOptions } from "../queries/worldImageQueries";
import {
  downscaleImageToBlob,
  WORLD_HERO_TARGET,
  WORLD_THUMBNAIL_TARGET,
} from "../utils/worldImageProcessing";

import { WorldAvatar } from "./WorldAvatar";
import { WorldHeroImage } from "./WorldHeroImage";

import type { WorldPermissionContext } from "../types/worldTypes";

type WorldImagesPanelProps = {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
  readonly worldName: string;
};

export function WorldImagesPanel({
  accessContext,
  canAdmin,
  isArchived,
  worldId,
  worldName,
}: WorldImagesPanelProps): JSX.Element {
  const imagesQuery = useQuery(worldImagesQueryOptions(worldId));

  if (imagesQuery.isPending) {
    return <LoadingState label="Loading world images…" />;
  }

  if (imagesQuery.isError) {
    return (
      <ErrorState
        title="World images could not be loaded"
        description={getErrorDescription(imagesQuery.error)}
      />
    );
  }

  const canEdit = canAdmin && !isArchived;

  return (
    <div className="grid gap-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-normal">
            World images
          </h2>
          {canEdit ? (
            <p className="text-sm text-muted-foreground">
              World admins can set a thumbnail and a dashboard hero banner.
            </p>
          ) : null}
        </div>
        {!canEdit ? (
          <span className="inline-flex w-fit rounded-sm bg-muted px-2 py-1 text-xs text-muted-foreground">
            Read-only
          </span>
        ) : null}
      </div>

      <ThumbnailSection
        canEdit={canEdit}
        accessContext={accessContext}
        thumbnailPath={imagesQuery.data.thumbnailPath}
        worldId={worldId}
        worldName={worldName}
      />

      <hr className="border-border" />

      <HeroSection
        canEdit={canEdit}
        accessContext={accessContext}
        heroPath={imagesQuery.data.heroPath}
        worldId={worldId}
      />
    </div>
  );
}

function ThumbnailSection({
  accessContext,
  canEdit,
  thumbnailPath,
  worldId,
  worldName,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly canEdit: boolean;
  readonly thumbnailPath: string | null;
  readonly worldId: string;
  readonly worldName: string;
}): JSX.Element {
  return (
    <section className="grid gap-3">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Thumbnail</h3>
        <p className="text-sm text-muted-foreground">
          Shown in the world list, the world switcher, and jump-to-world search
          results. Square images work best — uploads are center-cropped and
          downscaled to {String(WORLD_THUMBNAIL_TARGET.width)}×
          {String(WORLD_THUMBNAIL_TARGET.height)}.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <WorldAvatar
          className="size-16"
          thumbnailPath={thumbnailPath}
          worldId={worldId}
          worldName={worldName}
        />
        <ImageUploadControls
          accessContext={accessContext}
          canEdit={canEdit}
          hasImage={thumbnailPath !== null}
          kind="thumbnail"
          target={WORLD_THUMBNAIL_TARGET}
          worldId={worldId}
        />
      </div>
    </section>
  );
}

function HeroSection({
  accessContext,
  canEdit,
  heroPath,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly canEdit: boolean;
  readonly heroPath: string | null;
  readonly worldId: string;
}): JSX.Element {
  return (
    <section className="grid gap-3">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Hero banner</h3>
        <p className="text-sm text-muted-foreground">
          Wide banner for the world dashboard header. Uploads are center-cropped
          and downscaled to {String(WORLD_HERO_TARGET.width)}×
          {String(WORLD_HERO_TARGET.height)}.
        </p>
      </div>
      <div className="flex aspect-[4/1] w-full max-w-md items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
        <WorldHeroImage
          className="size-full object-cover"
          heroPath={heroPath}
        />
        {heroPath === null ? (
          <span className="text-xs text-muted-foreground">No hero image</span>
        ) : null}
      </div>
      <ImageUploadControls
        accessContext={accessContext}
        canEdit={canEdit}
        hasImage={heroPath !== null}
        kind="hero"
        target={WORLD_HERO_TARGET}
        worldId={worldId}
      />
    </section>
  );
}

function ImageUploadControls({
  accessContext,
  canEdit,
  hasImage,
  kind,
  target,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly canEdit: boolean;
  readonly hasImage: boolean;
  readonly kind: WorldImageKind;
  readonly target: { readonly height: number; readonly width: number };
  readonly worldId: string;
}): JSX.Element | null {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const label = kind === "thumbnail" ? "thumbnail" : "hero image";

  const uploadMutation = useMutation(
    uploadWorldImageMutationOptions({ accessContext, queryClient }),
  );
  const removeMutation = useMutation(
    removeWorldImageMutationOptions({ accessContext, queryClient }),
  );

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file === undefined) {
      return;
    }

    setIsProcessing(true);
    try {
      const blob = await downscaleImageToBlob(file, target);
      uploadMutation.mutate(
        { file: blob, kind, worldId },
        {
          onError: (error) => {
            notifyMutationError(error, `The ${label} could not be uploaded.`);
          },
          onSuccess: () => {
            notifyMutationSuccess(
              kind === "thumbnail"
                ? "Thumbnail updated."
                : "Hero image updated.",
            );
          },
        },
      );
    } catch (error) {
      notifyMutationError(error, `The ${label} could not be processed.`);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleRemove(): void {
    removeMutation.mutate(
      { kind, worldId },
      {
        onError: (error) => {
          notifyMutationError(error, `The ${label} could not be removed.`);
        },
        onSuccess: () => {
          notifyMutationSuccess(
            kind === "thumbnail" ? "Thumbnail removed." : "Hero image removed.",
          );
        },
      },
    );
  }

  if (!canEdit) {
    return null;
  }

  const isBusy = isProcessing || uploadMutation.isPending;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        onChange={(event) => {
          void handleFileChange(event);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isBusy}
        onClick={() => fileInputRef.current?.click()}
      >
        <ImageUp aria-hidden="true" />
        {hasImage ? `Replace ${label}` : `Upload ${label}`}
      </Button>
      {hasImage ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={removeMutation.isPending}
          onClick={handleRemove}
        >
          <Trash2 aria-hidden="true" />
          Remove
        </Button>
      ) : null}
    </div>
  );
}
