import { Readout } from "./Shared";

import type { Citizen } from "../../types/citizenTypes";
import type { JSX } from "react";

export function CitizenParentsSection({
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
