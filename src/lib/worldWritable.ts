export type WorldWritableCheckRow = {
  readonly archived_at: string | null;
  readonly status: string;
};

// Shared archived-world write guard. Every mutation that writes world-scoped
// data must refuse archived worlds; callers supply their own feature-specific
// error so codes/messages/types stay exactly as before.
export function assertWorldWritable(
  world: WorldWritableCheckRow,
  createArchivedError: () => Error,
): void {
  if (world.status === "archived" || world.archived_at !== null) {
    throw createArchivedError();
  }
}
