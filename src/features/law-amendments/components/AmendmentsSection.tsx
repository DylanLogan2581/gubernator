import { useQuery } from "@tanstack/react-query";
import { useState, type JSX, type ReactNode } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import {
  nationBodyResolverContextQueryOptions,
  nationGovernmentBodiesQueryOptions,
  settlementBodyResolverContextQueryOptions,
  settlementGovernmentBodiesQueryOptions,
} from "@/features/government-bodies";
import type { LawDocument } from "@/features/law-documents";
import {
  nationOfficeTypesQueryOptions,
  settlementOfficeTypesQueryOptions,
} from "@/features/nations";
import { useActivePlayerCharacter } from "@/features/permissions";
import { getErrorDescription } from "@/lib/errorUtils";
import {
  canProposeAmendment,
  resolveBodyMembers,
  validateAmendmentProcedure,
  type AmendmentActor,
  type AmendmentProcedure,
} from "@/shared/government";

import { lawAmendmentsForDocumentQueryOptions } from "../queries/lawAmendmentsQueries";

import { OpenAmendmentCard } from "./OpenAmendmentCard";
import { ProposeAmendmentDialog } from "./ProposeAmendmentDialog";
import { ResolvedAmendmentsList } from "./ResolvedAmendmentsList";

// Not a strict discriminated union like LawDocumentScopeContext (law-
// documents) -- the caller (LawDocumentViewDialog) already holds a properly
// narrowed union and would have to re-narrow it into a fresh object literal
// to satisfy one, which the "settlement" branch's extra field defeats via
// JSX's excess-property check. A plain optional settlementId (only
// meaningful when scope === "settlement", enforced by isNationScope checks
// below) keeps the call site simple.
export type AmendmentsSectionProps = {
  readonly currentTurnNumber: number;
  readonly document: LawDocument;
  readonly effectiveCanAdmin: boolean;
  readonly isArchived: boolean;
  readonly nationId: string;
  readonly scope: "nation" | "settlement";
  readonly settlementId?: string;
  readonly worldId: string;
};

function parseProcedure(value: unknown): AmendmentProcedure | null {
  try {
    return validateAmendmentProcedure(value);
  } catch {
    return null;
  }
}

// Amendment proposals, voting, and decree signing for one law document
// (#1120), mounted inside LawDocumentViewDialog. Every gate here is
// best-effort/advisory client-side UX -- propose_law_amendment and
// cast_law_amendment_vote are the real server-side eligibility gates, and
// their errors always surface via notifyMutationError regardless of what
// this component decided to show.
export function AmendmentsSection(props: AmendmentsSectionProps): JSX.Element {
  const { currentTurnNumber, document, effectiveCanAdmin, isArchived } = props;
  const isNationScope = props.scope === "nation";
  const settlementId = props.settlementId ?? "";

  const { activeCharacter } = useActivePlayerCharacter();

  const amendmentsQuery = useQuery(
    lawAmendmentsForDocumentQueryOptions(document.id),
  );

  const nationBodiesQuery = useQuery({
    ...nationGovernmentBodiesQueryOptions(props.nationId),
    enabled: isNationScope,
  });
  const settlementBodiesQuery = useQuery({
    ...settlementGovernmentBodiesQueryOptions(settlementId),
    enabled: !isNationScope,
  });
  const bodiesQuery = isNationScope ? nationBodiesQuery : settlementBodiesQuery;

  const nationResolverContextQuery = useQuery({
    ...nationBodyResolverContextQueryOptions(props.nationId),
    enabled: isNationScope,
  });
  const settlementResolverContextQuery = useQuery({
    ...settlementBodyResolverContextQueryOptions(settlementId),
    enabled: !isNationScope,
  });
  const resolverContextQuery = isNationScope
    ? nationResolverContextQuery
    : settlementResolverContextQuery;

  const nationOfficeTypesQuery = useQuery({
    ...nationOfficeTypesQueryOptions(props.worldId, props.nationId),
    enabled: isNationScope,
  });
  const settlementOfficeTypesQuery = useQuery({
    ...settlementOfficeTypesQueryOptions(props.worldId, props.nationId),
    enabled: !isNationScope,
  });
  const officeTypesQuery = isNationScope
    ? nationOfficeTypesQuery
    : settlementOfficeTypesQuery;

  const amendments = amendmentsQuery.data ?? [];

  const [proposing, setProposing] = useState(false);

  if (
    amendmentsQuery.isPending ||
    bodiesQuery.isPending ||
    resolverContextQuery.isPending ||
    officeTypesQuery.isPending
  ) {
    return (
      <AmendmentsCardFrame>
        <LoadingState label="Loading amendments…" />
      </AmendmentsCardFrame>
    );
  }

  if (
    amendmentsQuery.isError ||
    bodiesQuery.isError ||
    resolverContextQuery.isError ||
    officeTypesQuery.isError
  ) {
    return (
      <AmendmentsCardFrame>
        <ErrorState
          title="Amendments could not be loaded"
          description={getErrorDescription(
            amendmentsQuery.error ??
              bodiesQuery.error ??
              resolverContextQuery.error ??
              officeTypesQuery.error,
          )}
        />
      </AmendmentsCardFrame>
    );
  }

  const bodies = bodiesQuery.data;
  const resolverContext = resolverContextQuery.data;
  const officeTypes = officeTypesQuery.data;
  const procedure = parseProcedure(document.amendmentProcedure);
  const isDecree = procedure?.kind === "decree";

  const isRuler =
    activeCharacter !== null &&
    activeCharacter.status === "alive" &&
    (isNationScope
      ? activeCharacter.roleType === "nation_manager" &&
        activeCharacter.roleNationId === props.nationId
      : activeCharacter.roleType === "settlement_manager" &&
        activeCharacter.roleSettlementId === settlementId);

  const heldOfficeTypeIds = new Set(
    resolverContext.officeHolders
      .filter((holder) => holder.citizenId === activeCharacter?.id)
      .map((holder) => holder.officeTypeId),
  );

  // Only the active character's own membership matters for this gate, so
  // (mirroring the sidebar badge query) the alive set is just this one
  // citizen -- resolveBodyMembers only reports members present in the alive
  // set, collapsing "is a resolved member" to a boolean per body.
  const memberOfBodyIds = new Set<string>();
  if (procedure?.kind === "vote" && activeCharacter !== null) {
    const aliveCitizenIds = new Set([activeCharacter.id]);
    for (const bodyId of [procedure.bodyId, procedure.secondBodyId]) {
      if (bodyId === null) continue;
      const body = bodies.find((b) => b.id === bodyId);
      if (body === undefined) continue;
      if (
        resolveBodyMembers(body, {
          ...resolverContext,
          aliveCitizenIds,
        }).includes(activeCharacter.id)
      ) {
        memberOfBodyIds.add(bodyId);
      }
    }
  }

  const actor: AmendmentActor = {
    heldOfficeTypeIds,
    isRuler,
    isSuperAdmin: false,
    isWorldAdmin: effectiveCanAdmin,
    memberOfBodyIds,
  };
  const canPropose =
    !isArchived &&
    activeCharacter !== null &&
    procedure !== null &&
    canProposeAmendment(procedure, actor);

  const openAmendments = amendments.filter(
    (amendment) => amendment.status === "proposed",
  );
  const resolvedAmendments = amendments.filter(
    (amendment) => amendment.status !== "proposed",
  );
  const versionByAmendmentId = new Map(
    amendments
      .filter((amendment) => amendment.enactedVersion !== null)
      .map((amendment) => [amendment.id, amendment.enactedVersion as number]),
  );

  return (
    <AmendmentsCardFrame
      onPropose={canPropose ? () => setProposing(true) : undefined}
      proposeLabel={isDecree ? "Sign decree" : "Propose amendment"}
    >
      <div className="grid gap-3">
        <div className="grid gap-2">
          <h3 className="text-sm font-medium">Open amendments</h3>
          {openAmendments.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No amendments are currently open for a vote.
            </p>
          ) : (
            <ul className="grid gap-2">
              {openAmendments.map((amendment) =>
                procedure?.kind === "vote" ? (
                  <OpenAmendmentCard
                    key={amendment.id}
                    activeCharacter={activeCharacter}
                    amendment={amendment}
                    bodies={bodies}
                    currentTurnNumber={currentTurnNumber}
                    documentId={document.id}
                    effectiveCanAdmin={effectiveCanAdmin}
                    procedure={procedure}
                    resolverContext={resolverContext}
                  />
                ) : null,
              )}
            </ul>
          )}
        </div>

        <div className="grid gap-2 border-t border-border pt-3">
          <h3 className="text-sm font-medium">Resolved amendments</h3>
          <ResolvedAmendmentsList
            amendments={resolvedAmendments}
            documentId={document.id}
            documentTitle={document.title}
            versionByAmendmentId={versionByAmendmentId}
          />
        </div>
      </div>

      {proposing && activeCharacter !== null ? (
        <ProposeAmendmentDialog
          bodies={bodies}
          documentId={document.id}
          isDecree={isDecree}
          officeTypes={officeTypes}
          onClose={() => setProposing(false)}
          proposingCitizenId={activeCharacter.id}
        />
      ) : null}
    </AmendmentsCardFrame>
  );
}

function AmendmentsCardFrame({
  children,
  onPropose,
  proposeLabel,
}: {
  readonly children: ReactNode;
  readonly onPropose?: () => void;
  readonly proposeLabel?: string;
}): JSX.Element {
  return (
    <div
      aria-labelledby="law-amendments-heading"
      className="grid gap-3 border-t border-border pt-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="law-amendments-heading" className="text-base font-medium">
          Amendments
        </h2>
        {onPropose !== undefined ? (
          <Button type="button" variant="outline" size="sm" onClick={onPropose}>
            {proposeLabel}
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}
