import {
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState, type JSX, type ReactNode } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { getErrorDescription } from "@/lib/errorUtils";

export type ConfigCrudPanelRenderProps<T> = {
  readonly canEdit: boolean;
  readonly editingId: string | null;
  readonly items: readonly T[];
  readonly queryClient: QueryClient;
  readonly setEditingId: (id: string | null) => void;
  readonly showForm: boolean;
  readonly setShowForm: (show: boolean) => void;
  readonly showTrash: boolean;
};

type ConfigCrudPanelProps<T> = {
  readonly addButtonLabel?: string;
  readonly allData: UseQueryResult<readonly T[], Error>;
  readonly canEdit: boolean;
  readonly emptyDescription?: string;
  readonly emptyTitle: string;
  readonly headerTitle: string;
  readonly isTrashed: (item: T) => boolean;
  readonly renderContent: (props: ConfigCrudPanelRenderProps<T>) => ReactNode;
  readonly showTrashButton?: boolean;
};

export function ConfigCrudPanel<T>({
  addButtonLabel,
  allData,
  canEdit,
  emptyDescription,
  emptyTitle,
  headerTitle,
  isTrashed,
  renderContent,
  showTrashButton = true,
}: ConfigCrudPanelProps<T>): JSX.Element {
  const queryClient = useQueryClient();
  const [showTrash, setShowTrash] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (allData.isPending) {
    return <LoadingState label={`Loading ${headerTitle.toLowerCase()}…`} />;
  }

  if (allData.isError) {
    return (
      <ErrorState
        title={`${headerTitle} could not be loaded`}
        description={getErrorDescription(allData.error)}
      />
    );
  }

  const visibleItems = showTrash
    ? allData.data.filter(isTrashed)
    : allData.data.filter((item) => !isTrashed(item));

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-normal">{headerTitle}</h2>
        <div className="flex items-center gap-2">
          {canEdit && !showForm && !showTrash ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowForm(true)}
            >
              <Plus aria-hidden="true" />
              {addButtonLabel ?? `Add ${headerTitle.toLowerCase()}`}
            </Button>
          ) : null}
          {showTrashButton ? (
            <Button
              type="button"
              variant={showTrash ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label={showTrash ? "Hide trash" : "Show trash"}
              aria-pressed={showTrash}
              title={showTrash ? "Hide trash" : "Show trash"}
              onClick={() => setShowTrash((v) => !v)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>

      {visibleItems.length > 0 || (showForm && !showTrash) ? (
        renderContent({
          canEdit,
          editingId,
          items: visibleItems,
          queryClient,
          setEditingId,
          setShowForm,
          showForm,
          showTrash,
        })
      ) : showTrash ? (
        <EmptyState title={`No ${headerTitle.toLowerCase()} in trash`} />
      ) : (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      )}
    </div>
  );
}
