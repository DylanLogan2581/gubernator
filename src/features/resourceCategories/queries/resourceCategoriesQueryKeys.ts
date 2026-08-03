import { authStateQueryCacheKeys } from "@/lib/authStateQueryCache";

export const resourceCategoriesQueryKeys = {
  all: authStateQueryCacheKeys.resourceCategoriesAll,
  byWorld: (worldId: string) =>
    [...resourceCategoriesQueryKeys.all, "by-world", worldId] as const,
  detail: (categoryId: string) =>
    [...resourceCategoriesQueryKeys.all, "detail", categoryId] as const,
} as const;
