import { useMutation, type QueryClient } from "@tanstack/react-query";
import { Pencil, Save, X } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { updateCitizenNpcFieldsMutationOptions } from "../../mutations/citizensMutations";

import { getCitizenMutationErrorDescription } from "./ErrorMessages";
import { Readout } from "./Shared";

import type { Citizen } from "../../types/citizenTypes";

export function CitizenNpcNotesSection({
  canEdit,
  citizen,
  queryClient,
}: {
  readonly canEdit: boolean;
  readonly citizen: Citizen;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [personalityText, setPersonalityText] = useState(
    citizen.personalityText ?? "",
  );
  const [skillsText, setSkillsText] = useState(citizen.skillsText ?? "");

  const updateMutation = useMutation(
    updateCitizenNpcFieldsMutationOptions({ queryClient }),
  );

  function closeEditor(): void {
    setIsEditing(false);
    setPersonalityText(citizen.personalityText ?? "");
    setSkillsText(citizen.skillsText ?? "");
    updateMutation.reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    updateMutation.reset();
    updateMutation.mutate(
      {
        citizenId: citizen.id,
        npcFlaw: citizen.npcFlaw ?? "",
        npcGoal: citizen.npcGoal ?? "",
        npcSecretContradiction: citizen.npcSecretContradiction ?? "",
        npcTrait1: citizen.npcTrait1 ?? "",
        npcTrait2: citizen.npcTrait2 ?? "",
        personalityText,
        skillsText,
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

  if (!isEditing) {
    return (
      <section
        aria-labelledby="citizen-npc-notes-heading"
        className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="citizen-npc-notes-heading" className="text-base font-medium">
            Personality and skills
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
        <dl className="flex flex-col gap-2">
          <Readout label="Personality" value={citizen.personalityText} block />
          <Readout label="Skills" value={citizen.skillsText} block />
        </dl>
      </section>
    );
  }

  return (
    <form
      aria-label="Edit personality and skills"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Edit personality and skills</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={closeEditor}
          aria-label="Cancel edit"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Personality</span>
        <textarea
          className="min-h-16 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          disabled={updateMutation.isPending}
          value={personalityText}
          onChange={(event) => setPersonalityText(event.currentTarget.value)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Skills</span>
        <textarea
          className="min-h-16 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          disabled={updateMutation.isPending}
          value={skillsText}
          onChange={(event) => setSkillsText(event.currentTarget.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={updateMutation.isPending}>
          <Save aria-hidden="true" />
          {updateMutation.isPending ? "Saving…" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={closeEditor}
          disabled={updateMutation.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
