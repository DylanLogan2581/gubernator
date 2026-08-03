import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageUp, Stamp, Trash2 } from "lucide-react";
import { useRef, useState, type ChangeEvent, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNationManageAuthority } from "@/features/permissions";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  removeNationSealMutationOptions,
  uploadNationSealMutationOptions,
} from "../../mutations/nationImageMutations";
import {
  downscaleImageToBlob,
  NATION_SEAL_TARGET,
} from "../../utils/nationImageProcessing";
import { NationSealAvatar } from "../NationSealAvatar";

import type { Nation } from "../../types/nationTypes";

/**
 * Seal upload panel for a nation's overview tab. Mirrors NationFlagSection —
 * editable by world admins and by this nation's own (alive) nation_manager
 * citizen (#1373).
 */
export function NationSealSection({
  canAdminWorld,
  isArchived,
  nation,
}: {
  readonly canAdminWorld: boolean;
  readonly isArchived: boolean;
  readonly nation: Nation;
}): JSX.Element {
  const { canManageNation } = useNationManageAuthority({
    canAdmin: canAdminWorld,
    nationId: nation.id,
  });
  const canEdit = canManageNation && !isArchived;

  return (
    <Card aria-labelledby="nation-seal-heading" className="grid gap-4 p-4">
      <div className="flex items-center gap-2">
        <Stamp aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 id="nation-seal-heading" className="text-base font-medium">
          Seal
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <NationSealAvatar
          className="w-24"
          interactive
          nationId={nation.id}
          nationName={nation.name}
          sealPath={nation.sealPath}
        />
        <div className="flex flex-col gap-2">
          {nation.sealPath === null ? (
            <p className="text-sm text-muted-foreground">No seal uploaded.</p>
          ) : null}
          {canEdit ? <SealUploadControls nation={nation} /> : null}
        </div>
      </div>
    </Card>
  );
}

function SealUploadControls({
  nation,
}: {
  readonly nation: Nation;
}): JSX.Element {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const hasSeal = nation.sealPath !== null;

  const uploadMutation = useMutation(
    uploadNationSealMutationOptions({ queryClient }),
  );
  const removeMutation = useMutation(
    removeNationSealMutationOptions({ queryClient }),
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
      const blob = await downscaleImageToBlob(file, NATION_SEAL_TARGET);
      uploadMutation.mutate(
        { file: blob, nationId: nation.id },
        {
          onError: (error) => {
            notifyMutationError(error, "The seal could not be uploaded.");
          },
          onSuccess: () => {
            notifyMutationSuccess("Seal updated.");
          },
        },
      );
    } catch (error) {
      notifyMutationError(error, "The seal could not be processed.");
    } finally {
      setIsProcessing(false);
    }
  }

  function handleRemove(): void {
    removeMutation.mutate(
      { nationId: nation.id },
      {
        onError: (error) => {
          notifyMutationError(error, "The seal could not be removed.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Seal removed.");
        },
      },
    );
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
        {hasSeal ? "Replace seal" : "Upload seal"}
      </Button>
      {hasSeal ? (
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
