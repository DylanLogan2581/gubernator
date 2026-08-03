import { type JSX } from "react";

import { Input } from "@/components/ui/input";

type ManagedPopulationsFiltersProps = {
  readonly onSearchChange: (search: string) => void;
  readonly search: string;
};

export function ManagedPopulationsFilters({
  onSearchChange,
  search,
}: ManagedPopulationsFiltersProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label="Search population types by name"
        className="sm:w-[280px]"
        placeholder="Search by name…"
        value={search}
        onChange={(event) => {
          onSearchChange(event.currentTarget.value);
        }}
      />
    </div>
  );
}
