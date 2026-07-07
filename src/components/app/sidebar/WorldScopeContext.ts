import { createContext, use } from "react";

export type WorldScopeContextValue = {
  readonly isPending: boolean;
  readonly nationId: string | null;
  readonly settlementId: string | null;
};

const EMPTY_VALUE: WorldScopeContextValue = {
  isPending: false,
  nationId: null,
  settlementId: null,
};

export const WorldScopeContext = createContext<WorldScopeContextValue | null>(
  null,
);

export function useWorldScope(): WorldScopeContextValue {
  return use(WorldScopeContext) ?? EMPTY_VALUE;
}
