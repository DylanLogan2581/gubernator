import { type JSX } from "react";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { ResourceCategory } from "@/features/resourceCategories";

type ResourcesFiltersProps = {
  readonly categories: readonly ResourceCategory[];
  readonly categoryId: string | null;
  readonly onCategoryIdChange: (categoryId: string | null) => void;
  readonly onSearchChange: (search: string) => void;
  readonly search: string;
};

export function ResourcesFilters({
  categories,
  categoryId,
  onCategoryIdChange,
  onSearchChange,
  search,
}: ResourcesFiltersProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label="Search resources by name"
        className="sm:w-[280px]"
        placeholder="Search by name…"
        value={search}
        onChange={(event) => {
          onSearchChange(event.currentTarget.value);
        }}
      />
      <NativeSelect
        aria-label="Filter by category"
        className="sm:w-[200px]"
        value={categoryId ?? ""}
        onChange={(event) => {
          const next = event.currentTarget.value;
          onCategoryIdChange(next === "" ? null : next);
        }}
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
