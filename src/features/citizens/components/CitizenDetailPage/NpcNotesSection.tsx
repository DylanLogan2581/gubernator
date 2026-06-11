import { useMutation, type QueryClient } from "@tanstack/react-query";
import { Pencil, Save, X } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { updateCitizenNpcFieldsMutationOptions } from "../../mutations/citizensMutations";

import { Readout } from "./Shared";

import type { CitizenAdminDetails } from "../../types/citizenTypes";

export function CitizenNpcNotesSection({
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
  const [personalityText, setPersonalityText] = useState(
    adminDetails?.personalityText ?? "",
  );
  const [skillsText, setSkillsText] = useState(adminDetails?.skillsText ?? "");

  const updateMutation = useMutation(
    updateCitizenNpcFieldsMutationOptions({ queryClient }),
  );

  function closeEditor(): void {
    setIsEditing(false);
    setPersonalityText(adminDetails?.personalityText ?? "");
    setSkillsText(adminDetails?.skillsText ?? "");
    updateMutation.reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    updateMutation.reset();
    updateMutation.mutate(
      {
        citizenId,
        npcFlaw: adminDetails?.npcFlaw ?? "",
        npcGoal: adminDetails?.npcGoal ?? "",
        npcSecretContradiction: adminDetails?.npcSecretContradiction ?? "",
        npcTrait1: adminDetails?.npcTrait1 ?? "",
        npcTrait2: adminDetails?.npcTrait2 ?? "",
        personalityText,
        skillsText,
        worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to save notes.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Personality and skills saved.");
          setIsEditing(false);
        },
      },
    );
  }

  if (!isEditing) {
    return (
      <Card
        aria-labelledby="citizen-npc-notes-heading"
        className="grid gap-3 p-4"
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
          <Readout
            label="Personality"
            value={adminDetails?.personalityText ?? null}
            block
          />
          <Readout
            label="Skills"
            value={adminDetails?.skillsText ?? null}
            block
          />
        </dl>
      </Card>
    );
  }

  return (
    <form
      aria-label="Edit personality and skills"
      className="grid gap-3 p-4"
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
      <div className="grid gap-1 text-sm">
        <Label htmlFor="personality">Personality</Label>
        <textarea
          aria-label="Personality"
          id="personality"
          className="min-h-16 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          disabled={updateMutation.isPending}
          value={personalityText}
          onChange={(event) => setPersonalityText(event.currentTarget.value)}
        />
      </div>
      <div className="grid gap-1 text-sm">
        <Label htmlFor="skills">Skills</Label>
        <textarea
          aria-label="Skills"
          id="skills"
          className="min-h-16 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          disabled={updateMutation.isPending}
          value={skillsText}
          onChange={(event) => setSkillsText(event.currentTarget.value)}
        />
      </div>
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
