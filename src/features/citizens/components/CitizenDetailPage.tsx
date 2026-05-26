import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Heart, Pencil, Save, Skull, X } from "lucide-react";
import {
  useEffect,
  useState,
  type FormEvent,
  type JSX,
  type ReactNode,
} from "react";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RoleAssignmentControls,
  currentAccessContextQueryOptions,
  useActivePlayerCharacter,
} from "@/features/permissions";
import type { AccessContext } from "@/features/permissions";
import { settlementByIdQueryOptions } from "@/features/settlements";
import {
  isWorldNotFoundError,
  worldRouteAccessQueryOptions,
} from "@/features/worlds";
import type { WorldRouteAccess } from "@/features/worlds";
import { textInputLimits } from "@/lib/inputLimits";

import {
  isCitizenMutationError,
  markCitizenDeadMutationOptions,
  reviveCitizenMutationOptions,
  updateCitizenCoreMutationOptions,
  updateCitizenNpcFieldsMutationOptions,
} from "../mutations/citizensMutations";
import {
  isPlayerCharacterRoleMutationError,
  linkUserToCitizenMutationOptions,
  unlinkUserFromCitizenMutationOptions,
} from "../mutations/playerCharacterRoleMutations";
import { currentAssignmentForCitizenQueryOptions } from "../queries/citizenAssignmentsQueries";
import { citizenByIdQueryOptions } from "../queries/citizensQueries";

import { NpcFlavorEditor } from "./NpcFlavorEditor";
import { NpcFlavorLine } from "./NpcFlavorLine";
import { PartnershipHistoryPanel } from "./PartnershipHistoryPanel";

import type { CitizenAssignment } from "../types/citizenAssignmentTypes";
import type { Citizen, CitizenAssignmentType } from "../types/citizenTypes";
import type { NpcFlavor } from "../utils/npcFlavor";

type CitizenDetailPageProps = {
  readonly citizenId: string;
  readonly worldId: string;
};

export function CitizenDetailPage({
  citizenId,
  worldId,
}: CitizenDetailPageProps): JSX.Element {
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return (
      <CitizenDetailFrame worldId={worldId}>
        <LoadingState label="Loading world access…" />
      </CitizenDetailFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <CitizenDetailFrame worldId={worldId}>
        <ErrorState
          title="World access could not be loaded"
          description={getErrorDescription(accessContextQuery.error)}
        />
      </CitizenDetailFrame>
    );
  }

  return (
    <CitizenDetailWorldGate
      accessContext={accessContextQuery.data}
      citizenId={citizenId}
      worldId={worldId}
    />
  );
}

function CitizenDetailWorldGate({
  accessContext,
  citizenId,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly citizenId: string;
  readonly worldId: string;
}): JSX.Element {
  const worldQuery = useQuery(
    worldRouteAccessQueryOptions(worldId, accessContext),
  );

  if (accessContext.isAuthenticated && !accessContext.isActiveUser) {
    return (
      <CitizenDetailFrame worldId={worldId}>
        <AccessDeniedState
          title="Account access unavailable"
          description="Your Gubernator account is not active. Contact an administrator to restore access."
        />
      </CitizenDetailFrame>
    );
  }

  if (worldQuery.isPending) {
    return (
      <CitizenDetailFrame worldId={worldId}>
        <LoadingState label="Loading world…" />
      </CitizenDetailFrame>
    );
  }

  if (worldQuery.isError) {
    if (isWorldNotFoundError(worldQuery.error)) {
      return (
        <CitizenDetailFrame worldId={worldId}>
          <AccessDeniedState
            title="World unavailable"
            description="This world does not exist or your Gubernator account does not have access."
          />
        </CitizenDetailFrame>
      );
    }

    return (
      <CitizenDetailFrame worldId={worldId}>
        <ErrorState
          title="World could not be loaded"
          description={getErrorDescription(worldQuery.error)}
        />
      </CitizenDetailFrame>
    );
  }

  return (
    <CitizenDetailContent
      accessContext={accessContext}
      citizenId={citizenId}
      worldAccess={worldQuery.data}
      worldId={worldId}
    />
  );
}

function CitizenDetailContent({
  accessContext,
  citizenId,
  worldAccess,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly citizenId: string;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const citizenQuery = useQuery(citizenByIdQueryOptions(citizenId));

  if (citizenQuery.isPending) {
    return (
      <CitizenDetailFrame worldId={worldId}>
        <LoadingState label="Loading citizen…" />
      </CitizenDetailFrame>
    );
  }

  if (citizenQuery.isError) {
    return (
      <CitizenDetailFrame worldId={worldId}>
        <ErrorState
          title="Citizen could not be loaded"
          description={getErrorDescription(citizenQuery.error)}
        />
      </CitizenDetailFrame>
    );
  }

  const citizen = citizenQuery.data;
  if (citizen === null || citizen.worldId !== worldId) {
    return (
      <CitizenDetailFrame worldId={worldId}>
        <AccessDeniedState
          title="Citizen unavailable"
          description="This citizen does not exist or is not part of this world."
        />
      </CitizenDetailFrame>
    );
  }

  const isOwnLivingCharacter =
    citizen.status === "alive" &&
    citizen.userId !== null &&
    citizen.userId === accessContext.userId;

  if (!worldAccess.canAdmin && !isOwnLivingCharacter) {
    return <CitizenManagerRedirect citizen={citizen} worldId={worldId} />;
  }

  return (
    <CitizenDetailLoaded
      canAdmin={worldAccess.canAdmin}
      citizen={citizen}
      isArchived={worldAccess.header.isArchived}
      worldId={worldId}
    />
  );
}

// Per the feature guide, Nation Manager and Settlement Manager do not reach
// the citizen detail screen — bounce them to settlement detail with an
// explanation. The redirect needs the nationId for the URL, which only the
// settlement row carries, so we wait on that lookup before navigating.
function CitizenManagerRedirect({
  citizen,
  worldId,
}: {
  readonly citizen: Citizen;
  readonly worldId: string;
}): JSX.Element {
  const navigate = useNavigate();
  const { activeCharacter } = useActivePlayerCharacter();
  const settlementId = citizen.settlementId;
  const settlementQuery = useQuery({
    ...settlementByIdQueryOptions(settlementId ?? ""),
    enabled: settlementId !== null,
  });
  const settlement = settlementQuery.data ?? null;
  const nationId = settlement?.nationId ?? null;

  const isManager =
    activeCharacter !== null &&
    (activeCharacter.roleType === "nation_manager" ||
      activeCharacter.roleType === "settlement_manager");

  useEffect(() => {
    if (settlementId === null || nationId === null) {
      return;
    }
    void navigate({
      params: { nationId, settlementId, worldId },
      replace: true,
      to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId",
    });
  }, [navigate, nationId, settlementId, worldId]);

  function redirectDescription(): string {
    if (settlementId === null) {
      return "Only world administrators can view citizens that are not in a settlement.";
    }
    if (isManager) {
      return "Nation and settlement managers manage citizens from the settlement detail screen. Redirecting now…";
    }
    return "Citizen detail is only available for your own living character. You will be redirected to the settlement view.";
  }

  return (
    <CitizenDetailFrame worldId={worldId}>
      <AccessDeniedState
        title="Citizen detail not available"
        description={redirectDescription()}
      />
    </CitizenDetailFrame>
  );
}

function CitizenDetailLoaded({
  canAdmin,
  citizen,
  isArchived,
  worldId,
}: {
  readonly canAdmin: boolean;
  readonly citizen: Citizen;
  readonly isArchived: boolean;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const canEdit = canAdmin && !isArchived;

  return (
    <CitizenDetailFrame worldId={worldId}>
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal">
              {citizen.name}
            </h1>
            <StatusChip status={citizen.status} />
            <TypeChip citizenType={citizen.citizenType} />
          </div>
          <p className="text-sm text-muted-foreground">
            {citizen.citizenType === "npc"
              ? "Non-player character."
              : "Player character."}
          </p>
        </div>
      </header>

      <CitizenCoreSection
        canEdit={canEdit}
        citizen={citizen}
        queryClient={queryClient}
      />

      <CitizenParentsSection citizen={citizen} />

      <CitizenAssignmentSection citizenId={citizen.id} />

      {citizen.citizenType === "npc" ? (
        <>
          <CitizenNpcNotesSection
            canEdit={canEdit}
            citizen={citizen}
            queryClient={queryClient}
          />
          <CitizenNpcFlavorSection
            canEdit={canEdit}
            citizen={citizen}
            queryClient={queryClient}
          />
        </>
      ) : null}

      {citizen.citizenType === "player_character" ? (
        <CitizenPlayerCharacterSection
          canAdmin={canAdmin}
          canEdit={canEdit}
          citizen={citizen}
          isArchived={isArchived}
          queryClient={queryClient}
        />
      ) : null}

      <PartnershipHistoryPanel
        canAdmin={canAdmin}
        citizen={citizen}
        isArchived={isArchived}
      />

      {canAdmin ? (
        <CitizenLifecycleSection
          citizen={citizen}
          isArchived={isArchived}
          queryClient={queryClient}
        />
      ) : null}
    </CitizenDetailFrame>
  );
}

function CitizenCoreSection({
  canEdit,
  citizen,
  queryClient,
}: {
  readonly canEdit: boolean;
  readonly citizen: Citizen;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(citizen.name);
  const [sex, setSex] = useState(citizen.sex ?? "");
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  const updateMutation = useMutation(
    updateCitizenCoreMutationOptions({ queryClient }),
  );

  function resetForm(): void {
    setName(citizen.name);
    setSex(citizen.sex ?? "");
    setNameError(undefined);
    updateMutation.reset();
  }

  function closeEditor(): void {
    setIsEditing(false);
    resetForm();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setNameError(undefined);
    updateMutation.reset();

    if (name.trim().length === 0) {
      setNameError("Citizen name is required.");
      return;
    }

    updateMutation.mutate(
      {
        citizenId: citizen.id,
        name,
        sex,
        worldId: citizen.worldId,
      },
      {
        onSuccess: () => {
          setIsEditing(false);
        },
      },
    );
  }

  if (!isEditing) {
    return (
      <section
        aria-labelledby="citizen-core-heading"
        className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="citizen-core-heading" className="text-base font-medium">
            Core info
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
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Readout label="Name" value={citizen.name} />
          <Readout label="Sex" value={citizen.sex} />
          <Readout
            label="Born on turn"
            value={
              citizen.bornOnTurnNumber === null
                ? null
                : String(citizen.bornOnTurnNumber)
            }
          />
          <Readout label="Status" value={statusLabel(citizen.status)} />
        </dl>
      </section>
    );
  }

  return (
    <form
      aria-label="Edit citizen core"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Edit core info</h2>
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
        <span className="text-muted-foreground">Name</span>
        <Input
          aria-invalid={nameError === undefined ? undefined : true}
          aria-describedby={
            nameError === undefined ? undefined : "citizen-core-name-error"
          }
          disabled={updateMutation.isPending}
          maxLength={textInputLimits.citizenNameMax}
          required
          value={name}
          onChange={(event) => {
            setName(event.currentTarget.value);
            if (nameError !== undefined) {
              setNameError(undefined);
            }
          }}
        />
        {nameError === undefined ? null : (
          <p
            id="citizen-core-name-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {nameError}
          </p>
        )}
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Sex</span>
        <Input
          disabled={updateMutation.isPending}
          placeholder="Leave blank to clear"
          value={sex}
          onChange={(event) => setSex(event.currentTarget.value)}
        />
      </label>
      {updateMutation.isError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {getCitizenMutationErrorDescription(updateMutation.error)}
        </p>
      ) : null}
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

function CitizenParentsSection({
  citizen,
}: {
  readonly citizen: Citizen;
}): JSX.Element {
  return (
    <section
      aria-labelledby="citizen-parents-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <h2 id="citizen-parents-heading" className="text-base font-medium">
        Parents
      </h2>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Readout label="Parent A" value={citizen.parentACitizenId} mono />
        <Readout label="Parent B" value={citizen.parentBCitizenId} mono />
      </dl>
    </section>
  );
}

function CitizenAssignmentSection({
  citizenId,
}: {
  readonly citizenId: string;
}): JSX.Element {
  const assignmentQuery = useQuery(
    currentAssignmentForCitizenQueryOptions(citizenId),
  );

  return (
    <section
      aria-labelledby="citizen-assignment-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <h2 id="citizen-assignment-heading" className="text-base font-medium">
        Assignment
      </h2>
      {assignmentQuery.isPending ? (
        <LoadingState label="Loading assignment…" />
      ) : assignmentQuery.isError ? (
        <ErrorState
          title="Assignment could not be loaded"
          description={getErrorDescription(assignmentQuery.error)}
        />
      ) : (
        <CitizenAssignmentSummary assignment={assignmentQuery.data} />
      )}
    </section>
  );
}

function CitizenAssignmentSummary({
  assignment,
}: {
  readonly assignment: CitizenAssignment | null;
}): JSX.Element {
  if (assignment === null) {
    return (
      <p className="text-sm italic text-muted-foreground">
        This citizen has no current assignment.
      </p>
    );
  }

  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Readout
        label="Type"
        value={assignmentTypeLabel(assignment.assignmentType)}
      />
      <Readout
        label="Assigned on turn"
        value={String(assignment.assignedOnTurnNumber)}
      />
      <Readout label="Target" value={assignmentTargetLabel(assignment)} mono />
    </dl>
  );
}

function citizenToNpcFlavor(citizen: Citizen): NpcFlavor {
  return {
    contradiction: citizen.npcSecretContradiction ?? "",
    flaw: citizen.npcFlaw ?? "",
    goal: citizen.npcGoal ?? "",
    trait1: citizen.npcTrait1 ?? "",
    trait2: citizen.npcTrait2 ?? "",
  };
}

function CitizenNpcFlavorSection({
  canEdit,
  citizen,
  queryClient,
}: {
  readonly canEdit: boolean;
  readonly citizen: Citizen;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const updateMutation = useMutation(
    updateCitizenNpcFieldsMutationOptions({ queryClient }),
  );

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
        onSuccess: () => {
          setIsEditing(false);
        },
      },
    );
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
          onSave={handleSave}
          submitLabel={updateMutation.isPending ? "Saving…" : "Save flavor"}
        />
        {updateMutation.isError ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {getCitizenMutationErrorDescription(updateMutation.error)}
          </p>
        ) : null}
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

function CitizenNpcNotesSection({
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
      {updateMutation.isError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {getCitizenMutationErrorDescription(updateMutation.error)}
        </p>
      ) : null}
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

// Role and linked-user writes intentionally route through the dedicated
// SECURITY DEFINER mutations — direct table writes to `user_id` and the
// `role_*` columns are blocked by column-level grants.
function CitizenPlayerCharacterSection({
  canAdmin,
  canEdit,
  citizen,
  isArchived,
  queryClient,
}: {
  readonly canAdmin: boolean;
  readonly canEdit: boolean;
  readonly citizen: Citizen;
  readonly isArchived: boolean;
  readonly queryClient: QueryClient;
}): JSX.Element {
  return (
    <section
      aria-labelledby="citizen-player-character-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <div className="space-y-1">
        <h2
          id="citizen-player-character-heading"
          className="text-base font-medium"
        >
          Role and linked user
        </h2>
        <p className="text-sm text-muted-foreground">
          Player character role and the user that controls them.
        </p>
      </div>
      <CitizenLinkedUserControl
        canEdit={canEdit}
        citizen={citizen}
        queryClient={queryClient}
      />
      <RoleAssignmentControls
        canAdminWorld={canAdmin}
        citizen={citizen}
        isArchived={isArchived}
        variant="citizen"
      />
    </section>
  );
}

function CitizenLinkedUserControl({
  canEdit,
  citizen,
  queryClient,
}: {
  readonly canEdit: boolean;
  readonly citizen: Citizen;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [userIdInput, setUserIdInput] = useState(citizen.userId ?? "");
  const [inputError, setInputError] = useState<string | undefined>(undefined);

  const linkMutation = useMutation(
    linkUserToCitizenMutationOptions({ queryClient }),
  );
  const unlinkMutation = useMutation(
    unlinkUserFromCitizenMutationOptions({ queryClient }),
  );

  function closeEditor(): void {
    setIsEditing(false);
    setUserIdInput(citizen.userId ?? "");
    setInputError(undefined);
    linkMutation.reset();
  }

  function handleLink(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setInputError(undefined);
    linkMutation.reset();

    const trimmed = userIdInput.trim();
    if (trimmed.length === 0) {
      setInputError("User id is required.");
      return;
    }

    linkMutation.mutate(
      {
        citizenId: citizen.id,
        userId: trimmed,
        worldId: citizen.worldId,
      },
      {
        onSuccess: () => {
          setIsEditing(false);
        },
      },
    );
  }

  function handleUnlink(): void {
    unlinkMutation.reset();
    unlinkMutation.mutate({
      citizenId: citizen.id,
      worldId: citizen.worldId,
    });
  }

  const firstError = linkMutation.error ?? unlinkMutation.error ?? null;

  return (
    <div className="grid gap-2 rounded-md border border-border bg-background px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-0.5 text-sm">
          <span className="text-xs text-muted-foreground">Linked user</span>
          {citizen.userId === null ? (
            <span className="italic text-muted-foreground">
              No user linked.
            </span>
          ) : (
            <span className="font-mono text-xs">{citizen.userId}</span>
          )}
        </div>
        {canEdit && !isEditing ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Pencil aria-hidden="true" />
              {citizen.userId === null ? "Link user" : "Change user"}
            </Button>
            {citizen.userId === null ? null : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUnlink}
                disabled={unlinkMutation.isPending}
              >
                {unlinkMutation.isPending ? "Unlinking…" : "Unlink"}
              </Button>
            )}
          </div>
        ) : null}
      </div>
      {isEditing ? (
        <form className="grid gap-2" noValidate onSubmit={handleLink}>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">User id (UUID)</span>
            <Input
              aria-invalid={inputError === undefined ? undefined : true}
              disabled={linkMutation.isPending}
              value={userIdInput}
              onChange={(event) => {
                setUserIdInput(event.currentTarget.value);
                if (inputError !== undefined) {
                  setInputError(undefined);
                }
              }}
            />
            {inputError === undefined ? null : (
              <p role="alert" className="text-sm text-destructive">
                {inputError}
              </p>
            )}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={linkMutation.isPending}>
              <Save aria-hidden="true" />
              {linkMutation.isPending ? "Linking…" : "Link user"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={closeEditor}
              disabled={linkMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {firstError !== null ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {getRoleMutationErrorDescription(firstError)}
        </p>
      ) : null}
    </div>
  );
}

function CitizenLifecycleSection({
  citizen,
  isArchived,
  queryClient,
}: {
  readonly citizen: Citizen;
  readonly isArchived: boolean;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const [isMarkingDead, setIsMarkingDead] = useState(false);
  const [deathCause, setDeathCause] = useState("");

  const markDeadMutation = useMutation(
    markCitizenDeadMutationOptions({ queryClient }),
  );
  const reviveMutation = useMutation(
    reviveCitizenMutationOptions({ queryClient }),
  );

  function handleMarkDead(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    markDeadMutation.reset();
    markDeadMutation.mutate(
      {
        citizenId: citizen.id,
        deathCause,
        worldId: citizen.worldId,
      },
      {
        onSuccess: () => {
          setIsMarkingDead(false);
          setDeathCause("");
        },
      },
    );
  }

  function handleRevive(): void {
    reviveMutation.reset();
    reviveMutation.mutate({
      citizenId: citizen.id,
      worldId: citizen.worldId,
    });
  }

  const firstError = markDeadMutation.error ?? reviveMutation.error ?? null;

  return (
    <section
      aria-labelledby="citizen-lifecycle-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <div className="space-y-1">
        <h2 id="citizen-lifecycle-heading" className="text-base font-medium">
          Lifecycle
        </h2>
        <p className="text-sm text-muted-foreground">
          {citizen.status === "alive"
            ? "Mark this citizen dead if they have died in the world."
            : citizen.deathCause === null
              ? "This citizen is deceased."
              : `Cause of death: ${citizen.deathCause}`}
        </p>
      </div>
      {citizen.status === "alive" ? (
        isMarkingDead ? (
          <form className="grid gap-2" noValidate onSubmit={handleMarkDead}>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">
                Cause of death (optional)
              </span>
              <Input
                disabled={markDeadMutation.isPending || isArchived}
                value={deathCause}
                onChange={(event) => setDeathCause(event.currentTarget.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                variant="destructive"
                disabled={markDeadMutation.isPending || isArchived}
              >
                <Skull aria-hidden="true" />
                {markDeadMutation.isPending ? "Marking…" : "Mark dead"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsMarkingDead(false);
                  setDeathCause("");
                  markDeadMutation.reset();
                }}
                disabled={markDeadMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setIsMarkingDead(true)}
              disabled={isArchived}
              title={
                isArchived
                  ? "Cannot modify citizens in an archived world."
                  : undefined
              }
            >
              <Skull aria-hidden="true" />
              Mark dead
            </Button>
          </div>
        )
      ) : (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={handleRevive}
            disabled={reviveMutation.isPending || isArchived}
            title={
              isArchived
                ? "Cannot modify citizens in an archived world."
                : undefined
            }
          >
            <Heart aria-hidden="true" />
            {reviveMutation.isPending ? "Reviving…" : "Revive citizen"}
          </Button>
        </div>
      )}
      {firstError !== null ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {getCitizenMutationErrorDescription(firstError)}
        </p>
      ) : null}
    </section>
  );
}

function CitizenDetailFrame({
  children,
  worldId,
}: {
  readonly children: ReactNode;
  readonly worldId: string;
}): JSX.Element {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 py-6">
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link to="/worlds/$worldId" params={{ worldId }}>
          <ArrowLeft aria-hidden="true" />
          Back to world
        </Link>
      </Button>
      {children}
    </div>
  );
}

function Readout({
  block,
  label,
  mono,
  value,
}: {
  readonly block?: boolean;
  readonly label: string;
  readonly mono?: boolean;
  readonly value: string | null;
}): JSX.Element {
  return (
    <div
      className={`rounded-md border border-border bg-background px-3 py-2 ${
        block === true ? "sm:col-span-2" : ""
      }`}
    >
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`text-sm ${mono === true ? "font-mono text-xs" : ""} ${
          block === true ? "whitespace-pre-wrap" : ""
        }`}
      >
        {value === null || value === "" ? (
          <span className="italic text-muted-foreground">Not set</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function StatusChip({
  status,
}: {
  readonly status: Citizen["status"];
}): JSX.Element {
  const tone =
    status === "alive"
      ? "bg-secondary text-secondary-foreground"
      : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs ${tone}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function TypeChip({
  citizenType,
}: {
  readonly citizenType: Citizen["citizenType"];
}): JSX.Element {
  return (
    <span className="inline-flex items-center rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {citizenType === "npc" ? "NPC" : "Player character"}
    </span>
  );
}

function statusLabel(status: Citizen["status"]): string {
  return status === "alive" ? "Alive" : "Deceased";
}

function assignmentTypeLabel(type: CitizenAssignmentType): string {
  switch (type) {
    case "construction_project":
      return "Construction";
    case "culling":
      return "Culling";
    case "deposit":
      return "Deposit";
    case "husbandry":
      return "Husbandry";
    case "standard_job":
      return "Standard job";
    case "trade_route":
      return "Trade route";
  }
}

function assignmentTargetLabel(assignment: CitizenAssignment): string | null {
  switch (assignment.assignmentType) {
    case "standard_job":
      return assignment.jobId === null ? null : `Job #${assignment.jobId}`;
    case "construction_project":
      return assignment.constructionProjectId === null
        ? null
        : `Project #${assignment.constructionProjectId}`;
    case "deposit":
      return assignment.depositInstanceId === null
        ? null
        : `Deposit #${assignment.depositInstanceId}`;
    case "husbandry":
    case "culling":
      return assignment.managedPopulationInstanceId === null
        ? null
        : `Population #${assignment.managedPopulationInstanceId}`;
    case "trade_route":
      return assignment.tradeRouteId === null
        ? null
        : `Trade route #${assignment.tradeRouteId}`;
  }
}

function getErrorDescription(error: unknown): string {
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }
  return "Try refreshing the page. If the problem continues, contact an administrator.";
}

function getCitizenMutationErrorDescription(error: unknown): string {
  if (isCitizenMutationError(error)) {
    const firstIssue = error.issues[0];
    if (firstIssue !== undefined) {
      return firstIssue.message;
    }
    return error.message;
  }
  return getErrorDescription(error);
}

function getRoleMutationErrorDescription(error: unknown): string {
  if (isPlayerCharacterRoleMutationError(error)) {
    const firstIssue = error.issues[0];
    if (firstIssue !== undefined) {
      return firstIssue.message;
    }
    return error.message;
  }
  return getErrorDescription(error);
}
