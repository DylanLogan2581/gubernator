import { useState, type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type TrashedEntityRowProps = {
  readonly name: string;
  readonly isPending: boolean;
  readonly onRestore: () => void;
  readonly onHardDelete: () => void;
};

export function TrashedEntityRow({
  name,
  isPending,
  onRestore,
  onHardDelete,
}: TrashedEntityRowProps): JSX.Element {
  const [hardDeleteConfirmOpen, setHardDeleteConfirmOpen] = useState(false);

  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{name}</span>
          <Badge variant="outline">trashed</Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={onRestore}
        >
          Restore
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setHardDeleteConfirmOpen(true);
          }}
        >
          Delete permanently
        </Button>
      </div>
      {hardDeleteConfirmOpen ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setHardDeleteConfirmOpen(false);
          }}
          title={`Permanently delete ${name}?`}
          description={
            <>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">{name}</span> and
              all its data. This action cannot be undone.
            </>
          }
          confirmLabel="Delete permanently"
          isPending={isPending}
          onConfirm={() => {
            onHardDelete();
          }}
        />
      ) : null}
    </li>
  );
}
