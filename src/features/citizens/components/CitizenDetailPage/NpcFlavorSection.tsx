import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useState, type JSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { worldNpcFlavorConfigQueryOptions } from "@/features/worlds";
import { createSeededRng } from "@/lib/seededRng";
import { generateLocalId } from "@/lib/uid";

import { updateCitizenNpcFieldsMutationOptions } from "../../mutations/citizensMutations";
import { generateNpcFlavor, type NpcFlavor } from "../../utils/npcFlavor";
import { NpcFlavorEditor } from "../NpcFlavorEditor";
import { NpcFlavorLine } from "../NpcFlavorLine";

import { getCitizenMutationErrorDescription } from "./ErrorMessages";
import { Readout } from "./Shared";

import type { Citizen } from "../../types/citizenTypes";

function citizenToNpcFlavor(citizen: Citizen): NpcFlavor {
  return {
    contradiction: citizen.npcSecretContradiction ?? "",
    flaw: citizen.npcFlaw ?? "",
    goal: citizen.npcGoal ?? "",
    trait1: citizen.npcTrait1 ?? "",
    trait2: citizen.npcTrait2 ?? "",
  };
}

export function CitizenNpcFlavorSection({
  canEdit,
  citizen,
  queryClient,
  worldId,
}: {
  readonly canEdit: boolean;
  readonly citizen: Citizen;
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
        citizenId: citizen.id,
        npcFlaw: next.flaw,
        npcGoal: next.goal,
        npcSecretContradiction: next.contradiction,
        npcTrait1: next.trait1,
        npcTrait2: next.trait2,
        personalityText: citizen.personalityText ?? "",
        skillsText: citizen.skillsText ?? "",
        worldId: citizen.worldId,
      },
      {
        onError: (error) => {
          toast.error(getCitizenMutationErrorDescription(error));
        },
        onSuccess: () => {
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

  if (isEditing) {
    return (
      <section
        aria-labelledby="citizen-npc-flavor-heading"
        className="grid gap-3"
      >
        <h2 id="citizen-npc-flavor-heading" className="sr-only">
          NPC flavor
        </h2>
        <NpcFlavorEditor
          disabled={updateMutation.isPending}
          initial={citizenToNpcFlavor(citizen)}
          onCancel={closeEditor}
          onGenerate={
            flavorConfigQuery.data !== undefined ? handleGenerate : undefined
          }
          onSave={handleSave}
          submitLabel={updateMutation.isPending ? "Saving…" : "Save flavor"}
        />
      </section>
    );
  }

  return (
    <section
      aria-labelledby="citizen-npc-flavor-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
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
      <NpcFlavorLine
        citizenId={citizen.id}
        flavor={citizenToNpcFlavor(citizen)}
      />
      <dl className="flex flex-col gap-2">
        <Readout label="Trait 1" value={citizen.npcTrait1} />
        <Readout label="Trait 2" value={citizen.npcTrait2} />
        <Readout label="Goal" value={citizen.npcGoal} block />
        <Readout label="Flaw" value={citizen.npcFlaw} block />
        <Readout
          label="Secret / contradiction"
          value={citizen.npcSecretContradiction}
          block
        />
      </dl>
    </section>
  );
}
