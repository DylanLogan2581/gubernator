import { Plus, Trash2 } from "lucide-react";
import { type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

type ConfigListPanelProps<
  T extends { readonly id: string; readonly isTrashed: boolean },
> = {
  readonly title: string;
  readonly addButtonLabel: string;
  readonly emptyTrashTitle: string;
  readonly emptyNormalTitle: string;
  readonly emptyNormalDescription?: string;
  readonly canEdit: boolean;
  readonly showTrash: boolean;
  readonly showCreateForm: boolean;
  readonly entities: readonly T[];
  readonly renderRow: (entity: T) => JSX.Element;
  readonly renderTrashedRow: (entity: T) => JSX.Element;
  readonly onToggleTrash: () => void;
  readonly onToggleCreateForm: () => void;
};

export function ConfigListPanel<
  T extends { readonly id: string; readonly isTrashed: boolean },
>({
  title,
  addButtonLabel,
  emptyTrashTitle,
  emptyNormalTitle,
  emptyNormalDescription,
  canEdit,
  showTrash,
  showCreateForm,
  entities,
  renderRow,
  renderTrashedRow,
  onToggleTrash,
  onToggleCreateForm,
}: ConfigListPanelProps<T>): JSX.Element {
  const visibleEntities = showTrash
    ? entities.filter((entity) => entity.isTrashed)
    : entities.filter((entity) => !entity.isTrashed);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
        <div className="flex items-center gap-2">
          {canEdit && !showCreateForm && !showTrash ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onToggleCreateForm}
            >
              <Plus aria-hidden="true" />
              {addButtonLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            variant={showTrash ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={showTrash ? "Hide trash" : "Show trash"}
            aria-pressed={showTrash}
            title={showTrash ? "Hide trash" : "Show trash"}
            onClick={onToggleTrash}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>

      {visibleEntities.length > 0 ? (
        <ul aria-label={title} className="grid gap-2">
          {visibleEntities.map((entity) => {
            if (showTrash) {
              return <li key={entity.id}>{renderTrashedRow(entity)}</li>;
            }
            return <li key={entity.id}>{renderRow(entity)}</li>;
          })}
        </ul>
      ) : showTrash ? (
        <EmptyState title={emptyTrashTitle} />
      ) : (
        <EmptyState
          title={emptyNormalTitle}
          description={emptyNormalDescription}
        />
      )}
    </div>
  );
}
