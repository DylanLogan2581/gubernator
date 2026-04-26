import { EmptyState } from "@/components/shared/EmptyState";

import type { JSX } from "react";

export function WorldListPage(): JSX.Element {
  return (
    <div className="mx-auto max-w-4xl py-6">
      <EmptyState
        title="Worlds"
        description="Your worlds will appear here once world management is available."
      />
    </div>
  );
}
