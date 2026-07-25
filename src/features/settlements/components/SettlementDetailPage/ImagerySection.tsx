import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag, ImageUp, Stamp, Trash2 } from "lucide-react";
import {
  useRef,
  useState,
  type ChangeEvent,
  type JSX,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  removeSettlementFlagMutationOptions,
  removeSettlementSealMutationOptions,
  uploadSettlementFlagMutationOptions,
  uploadSettlementSealMutationOptions,
} from "../../mutations/settlementImageMutations";
import {
  downscaleImageToBlob,
  SETTLEMENT_FLAG_TARGET,
  SETTLEMENT_SEAL_TARGET,
  type ImageTargetSize,
} from "../../utils/settlementImageProcessing";
import { SettlementFlagAvatar } from "../SettlementFlagAvatar";
import { SettlementSealAvatar } from "../SettlementSealAvatar";

import type { SettlementWithNation } from "../../types/settlementTypes";
import type { UseMutationResult } from "@tanstack/react-query";

/**
 * Flag + seal upload panels for a settlement's overview tab. Mirrors the
 * nation flag/seal sections — editable by anyone who manages this settlement
 * (world admins, the parent nation's manager, or the settlement's own
 * manager); the seal also serves as its overview display (#1373).
 */
export function SettlementImagerySection({
  canEdit,
  settlement,
}: {
  readonly canEdit: boolean;
  readonly settlement: SettlementWithNation;
}): JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card
        aria-labelledby="settlement-flag-heading"
        className="grid gap-4 p-4"
      >
        <SectionHeading id="settlement-flag-heading" label="Flag">
          <Flag aria-hidden="true" className="size-4 text-muted-foreground" />
        </SectionHeading>
        <div className="flex items-center gap-4">
          <SettlementFlagAvatar
            className="w-24"
            flagPath={settlement.flagPath}
            interactive
            settlementId={settlement.id}
            settlementName={settlement.name}
          />
          <FlagControls canEdit={canEdit} settlement={settlement} />
        </div>
      </Card>

      <Card
        aria-labelledby="settlement-seal-heading"
        className="grid gap-4 p-4"
      >
        <SectionHeading id="settlement-seal-heading" label="Seal">
          <Stamp aria-hidden="true" className="size-4 text-muted-foreground" />
        </SectionHeading>
        <div className="flex items-center gap-4">
          <SettlementSealAvatar
            className="w-24"
            interactive
            sealPath={settlement.sealPath}
            settlementId={settlement.id}
            settlementName={settlement.name}
          />
          <SealControls canEdit={canEdit} settlement={settlement} />
        </div>
      </Card>
    </div>
  );
}

function SectionHeading({
  children,
  id,
  label,
}: {
  readonly children: ReactNode;
  readonly id: string;
  readonly label: string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      {children}
      <h2 id={id} className="text-base font-medium">
        {label}
      </h2>
    </div>
  );
}

function FlagControls({
  canEdit,
  settlement,
}: {
  readonly canEdit: boolean;
  readonly settlement: SettlementWithNation;
}): JSX.Element {
  const queryClient = useQueryClient();
  const uploadMutation = useMutation(
    uploadSettlementFlagMutationOptions({ queryClient }),
  );
  const removeMutation = useMutation(
    removeSettlementFlagMutationOptions({ queryClient }),
  );

  return (
    <ImageUploadControls
      canEdit={canEdit}
      hasImage={settlement.flagPath !== null}
      noun="flag"
      removeMutation={removeMutation}
      settlementId={settlement.id}
      target={SETTLEMENT_FLAG_TARGET}
      uploadMutation={uploadMutation}
    />
  );
}

function SealControls({
  canEdit,
  settlement,
}: {
  readonly canEdit: boolean;
  readonly settlement: SettlementWithNation;
}): JSX.Element {
  const queryClient = useQueryClient();
  const uploadMutation = useMutation(
    uploadSettlementSealMutationOptions({ queryClient }),
  );
  const removeMutation = useMutation(
    removeSettlementSealMutationOptions({ queryClient }),
  );

  return (
    <ImageUploadControls
      canEdit={canEdit}
      hasImage={settlement.sealPath !== null}
      noun="seal"
      removeMutation={removeMutation}
      settlementId={settlement.id}
      target={SETTLEMENT_SEAL_TARGET}
      uploadMutation={uploadMutation}
    />
  );
}

function ImageUploadControls({
  canEdit,
  hasImage,
  noun,
  removeMutation,
  settlementId,
  target,
  uploadMutation,
}: {
  readonly canEdit: boolean;
  readonly hasImage: boolean;
  readonly noun: "flag" | "seal";
  readonly removeMutation: UseMutationResult<
    void,
    unknown,
    { readonly settlementId: string }
  >;
  readonly settlementId: string;
  readonly target: ImageTargetSize;
  readonly uploadMutation: UseMutationResult<
    string,
    unknown,
    { readonly file: Blob; readonly settlementId: string }
  >;
}): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const capitalizedNoun = noun === "flag" ? "Flag" : "Seal";

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
        { file: blob, settlementId },
        {
          onError: (error) => {
            notifyMutationError(error, `The ${noun} could not be uploaded.`);
          },
          onSuccess: () => {
            notifyMutationSuccess(`${capitalizedNoun} updated.`);
          },
        },
      );
    } catch (error) {
      notifyMutationError(error, `The ${noun} could not be processed.`);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleRemove(): void {
    removeMutation.mutate(
      { settlementId },
      {
        onError: (error) => {
          notifyMutationError(error, `The ${noun} could not be removed.`);
        },
        onSuccess: () => {
          notifyMutationSuccess(`${capitalizedNoun} removed.`);
        },
      },
    );
  }

  const isBusy = isProcessing || uploadMutation.isPending;

  return (
    <div className="flex flex-col gap-2">
      {!hasImage ? (
        <p className="text-sm text-muted-foreground">No {noun} uploaded.</p>
      ) : null}
      {canEdit ? (
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
            {hasImage ? `Replace ${noun}` : `Upload ${noun}`}
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
      ) : null}
    </div>
  );
}
