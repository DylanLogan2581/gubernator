import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { worldNpcFlavorConfigQueryOptions } from "@/features/worlds";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import { createSeededRng } from "@/lib/seededRng";
import { generateLocalId } from "@/lib/uid";

import { updateCitizenNpcFieldsMutationOptions } from "../../mutations/citizensMutations";
import { generateNpcFlavor, type NpcFlavor } from "../../utils/npcFlavor";
import { NpcFlavorEditor } from "../NpcFlavorEditor";
import { NpcFlavorLine } from "../NpcFlavorLine";

import { Readout } from "./Shared";

import type { CitizenAdminDetails } from "../../types/citizenTypes";

function adminDetailsToNpcFlavor(
  adminDetails: CitizenAdminDetails | null,
): NpcFlavor {
  return {
    contradiction: adminDetails?.npcSecretContradiction ?? "",
    flaw: adminDetails?.npcFlaw ?? "",
    goal: adminDetails?.npcGoal ?? "",
    trait1: adminDetails?.npcTrait1 ?? "",
    trait2: adminDetails?.npcTrait2 ?? "",
  };
}

export function CitizenNpcFlavorSection({
  adminDetails,
  canEdit,
  citizenId,
  queryClient,
  worldId,
}: {
  readonly adminDetails: CitizenAdminDetails | null;
  readonly canEdit: boolean;
  readonly citizenId: string;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const updateMutation = useMutation(
    updateCitizenNpcFieldsMutationOptions({ queryClient }),
  );
  const flavorConfigQuery = useQuery(worldNpcFlavorConfigQueryOptions(worldId));

  function closeEditor(): void {
    setIsEditing(false);
    updateMutation.reset();
  }

  function handleSave(next: NpcFlavor): void {
    updateMutation.reset();
    updateMutation.mutate(
      {
        citizenId,
        npcFlaw: next.flaw,
        npcGoal: next.goal,
        npcSecretContradiction: next.contradiction,
        npcTrait1: next.trait1,
        npcTrait2: next.trait2,
        personalityText: adminDetails?.personalityText ?? "",
        skillsText: adminDetails?.skillsText ?? "",
        worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update citizen flavor.");
        },
        onSuccess: () => {
          notifyMutationSuccess("NPC flavor saved.");
          setIsEditing(false);
        },
      },
    );
  }

  function handleGenerate(): NpcFlavor {
    const config = flavorConfigQuery.data ?? {
      traits: [],
      contradictions: [],
      goals: [],
      flaws: [],
    };
    return generateNpcFlavor(config, createSeededRng(generateLocalId()));
  }

  const currentFlavor = adminDetailsToNpcFlavor(adminDetails);

  if (isEditing) {
    return (
      <Card
        aria-labelledby="citizen-npc-flavor-heading"
        className="grid gap-3 p-4"
      >
        <h2 id="citizen-npc-flavor-heading" className="sr-only">
          NPC flavor
        </h2>
        <NpcFlavorEditor
          disabled={updateMutation.isPending}
          initial={currentFlavor}
          onCancel={closeEditor}
          onGenerate={
            flavorConfigQuery.data !== undefined ? handleGenerate : undefined
          }
          onSave={handleSave}
          submitLabel={updateMutation.isPending ? "Saving…" : "Save flavor"}
        />
      </Card>
    );
  }

  return (
    <Card
      aria-labelledby="citizen-npc-flavor-heading"
      className="grid gap-3 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="citizen-npc-flavor-heading" className="text-base font-medium">
          NPC flavor
        </h2>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            <Pencil aria-hidden="true" />
            Edit
          </Button>
        ) : null}
      </div>
      <NpcFlavorLine citizenId={citizenId} flavor={currentFlavor} />
      <dl className="flex flex-col gap-2">
        <Readout label="Trait 1" value={adminDetails?.npcTrait1 ?? null} />
        <Readout label="Trait 2" value={adminDetails?.npcTrait2 ?? null} />
        <Readout label="Goal" value={adminDetails?.npcGoal ?? null} block />
        <Readout label="Flaw" value={adminDetails?.npcFlaw ?? null} block />
        <Readout
          label="Secret / contradiction"
          value={adminDetails?.npcSecretContradiction ?? null}
          block
        />
      </dl>
    </Card>
  );
}
