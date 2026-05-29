import { useQuery } from "@tanstack/react-query";

import { currentAssignmentForCitizenQueryOptions } from "../queries/citizenAssignmentsQueries";
import {
  roleLabelForAssignment,
  renderNpcFlavorLine,
  type NpcFlavor,
} from "../utils/npcFlavor";

import type { JSX } from "react";

type NpcFlavorLineProps = {
  readonly className?: string;
  readonly flavor: NpcFlavor;
} & ({ readonly role: string | null } | { readonly citizenId: string });

export function NpcFlavorLine(props: NpcFlavorLineProps): JSX.Element {
  if ("citizenId" in props) {
    return (
      <NpcFlavorLineForCitizen
        citizenId={props.citizenId}
        className={props.className}
        flavor={props.flavor}
      />
    );
  }
  return (
    <NpcFlavorLineDisplay
      className={props.className}
      flavor={props.flavor}
      role={props.role}
    />
  );
}

function NpcFlavorLineForCitizen({
  citizenId,
  className,
  flavor,
}: {
  readonly citizenId: string;
  readonly className: string | undefined;
  readonly flavor: NpcFlavor;
}): JSX.Element {
  const assignmentQuery = useQuery(
    currentAssignmentForCitizenQueryOptions(citizenId),
  );
  const role = assignmentQuery.isSuccess
    ? roleLabelForAssignment(assignmentQuery.data)
    : null;
  return (
    <NpcFlavorLineDisplay className={className} flavor={flavor} role={role} />
  );
}

function NpcFlavorLineDisplay({
  className,
  flavor,
  role,
}: {
  readonly className: string | undefined;
  readonly flavor: NpcFlavor;
  readonly role: string | null;
}): JSX.Element {
  const sentence = renderNpcFlavorLine(flavor, role);
  return (
    <p className={className ?? "text-sm leading-relaxed text-muted-foreground"}>
      {sentence}
    </p>
  );
}
