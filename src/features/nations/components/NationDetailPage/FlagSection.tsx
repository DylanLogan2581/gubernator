import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag, ImageUp, Trash2 } from "lucide-react";
import { useRef, useState, type ChangeEvent, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useActivePlayerCharacter } from "@/features/permissions";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  removeNationFlagMutationOptions,
  uploadNationFlagMutationOptions,
} from "../../mutations/nationImageMutations";
import {
  downscaleImageToBlob,
  NATION_FLAG_TARGET,
} from "../../utils/nationImageProcessing";
import { NationFlagAvatar } from "../NationFlagAvatar";

import type { Nation } from "../../types/nationTypes";

/**
 * Flag upload panel for a nation's overview tab. Mirrors the
 * canAdminWorld/isNationManager visibility check used by
 * NationIdentitySection — editable by world admins and by this nation's own
 * (alive) nation_manager citizen (#1072).
 */
export function NationFlagSection({
  canAdminWorld,
  isArchived,
  nation,
}: {
  readonly canAdminWorld: boolean;
  readonly isArchived: boolean;
  readonly nation: Nation;
}): JSX.Element {
  const { activeCharacter } = useActivePlayerCharacter();
  const isNationManager =
    activeCharacter !== null &&
    activeCharacter.roleType === "nation_manager" &&
    activeCharacter.roleNationId === nation.id &&
    activeCharacter.status === "alive";
  const canEdit = (canAdminWorld || isNationManager) && !isArchived;

  return (
    <Card aria-labelledby="nation-flag-heading" className="grid gap-4 p-4">
      <div className="flex items-center gap-2">
        <Flag aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 id="nation-flag-heading" className="text-base font-medium">
          Flag
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <NationFlagAvatar
          className="w-24"
          flagPath={nation.flagPath}
          interactive
          nationId={nation.id}
          nationName={nation.name}
        />
        {canEdit ? <FlagUploadControls nation={nation} /> : null}
      </div>
    </Card>
  );
}

function FlagUploadControls({
  nation,
}: {
  readonly nation: Nation;
}): JSX.Element {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const hasFlag = nation.flagPath !== null;

  const uploadMutation = useMutation(
    uploadNationFlagMutationOptions({ queryClient }),
  );
  const removeMutation = useMutation(
    removeNationFlagMutationOptions({ queryClient }),
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
      const blob = await downscaleImageToBlob(file, NATION_FLAG_TARGET);
      uploadMutation.mutate(
        { file: blob, nationId: nation.id },
        {
          onError: (error) => {
            notifyMutationError(error, "The flag could not be uploaded.");
          },
          onSuccess: () => {
            notifyMutationSuccess("Flag updated.");
          },
        },
      );
    } catch (error) {
      notifyMutationError(error, "The flag could not be processed.");
    } finally {
      setIsProcessing(false);
    }
  }

  function handleRemove(): void {
    removeMutation.mutate(
      { nationId: nation.id },
      {
        onError: (error) => {
          notifyMutationError(error, "The flag could not be removed.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Flag removed.");
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
        {hasFlag ? "Replace flag" : "Upload flag"}
      </Button>
      {hasFlag ? (
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
