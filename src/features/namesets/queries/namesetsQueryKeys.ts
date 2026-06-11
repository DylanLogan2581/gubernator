export const namesetsQueryKeys = {
  all: ["namesets"] as const,
  byWorld: (worldId: string) => ["namesets", "by-world", worldId] as const,
  activeByWorld: (worldId: string) =>
    ["namesets", "active-by-world", worldId] as const,
  detail: (namesetId: string) => ["namesets", "detail", namesetId] as const,
};
