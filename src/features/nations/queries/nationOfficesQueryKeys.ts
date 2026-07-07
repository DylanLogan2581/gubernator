import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const nationOfficesQueryKeys = {
  all: authStateQueryCacheKeys.nationsAll,
  roster: (nationId: string) =>
    [...nationOfficesQueryKeys.all, "offices", "roster", nationId] as const,
} as const;
