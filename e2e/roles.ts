export type Role =
  | "superadmin"
  | "world-admin"
  | "nation-manager"
  | "settlement-manager"
  | "player";

export const ROLES: Record<Role, { email: string; password: string }> = {
  superadmin: {
    email: "superadmin@gubernator.local",
    password: "password123",
  },
  "world-admin": {
    email: "worldadmin@gubernator.local",
    password: "password123",
  },
  "nation-manager": {
    email: "other@gubernator.local",
    password: "password123",
  },
  "settlement-manager": {
    email: "test@gubernator.local",
    password: "password123",
  },
  player: { email: "player@gubernator.local", password: "password123" },
};
