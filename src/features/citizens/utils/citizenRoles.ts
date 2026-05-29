import type { CitizenRoleType } from "../types/citizenTypes";

export function isManagerRole(roleType: CitizenRoleType): boolean {
  switch (roleType) {
    case "nation_manager":
    case "settlement_manager":
      return true;
    case "none":
      return false;
  }
}

export function isPlayerRole(roleType: CitizenRoleType): boolean {
  switch (roleType) {
    case "none":
      return true;
    case "nation_manager":
    case "settlement_manager":
      return false;
  }
}

export function managerScopeLabel(
  roleType: CitizenRoleType,
): "nation" | "settlement" | null {
  switch (roleType) {
    case "nation_manager":
      return "nation";
    case "settlement_manager":
      return "settlement";
    case "none":
      return null;
  }
}
