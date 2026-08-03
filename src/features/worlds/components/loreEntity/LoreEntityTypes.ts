import type { AuthUiError } from "@/features/auth";

import type { ConfigTabId } from "../../configTabs";
import type {
  QueryClient,
  UseMutationOptions,
  UseQueryOptions,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { z } from "zod";

/**
 * Fields shared by every lore entity (cultures, religions). Lore fields differ
 * per entity and are read generically via {@link LoreEntityDescriptor.loreFieldKeys}.
 */
export type LoreEntityBase = {
  readonly color: string;
  readonly createdAt: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
  readonly worldId: string;
};

export type LoreEntityUsage = {
  readonly citizenCount: number;
  readonly nationCount: number;
};

export type LoreEntityLabels = {
  /** Lower-case singular, e.g. "culture". */
  readonly singular: string;
  /** Capitalised singular, e.g. "Culture". */
  readonly singularCapital: string;
  /** Lower-case plural, e.g. "cultures". */
  readonly plural: string;
  /** Capitalised plural, e.g. "Cultures". */
  readonly pluralCapital: string;
};

export type LoreEntityLoreField = {
  readonly key: string;
  readonly label: string;
};

export type LoreEntityLoreSection = {
  readonly title: string;
  readonly fields: readonly LoreEntityLoreField[];
};

/** Partial patch of writable columns keyed by their client-side field name. */
export type LoreEntityUpdatePatch = Readonly<Record<string, string>>;

type LoreEntityQueryOptions<TData> = UseQueryOptions<
  TData,
  AuthUiError,
  TData,
  readonly unknown[]
>;

/**
 * Everything the shared lore-entity UI needs to render one entity type. Each
 * feature (cultures, religions) supplies a descriptor; the components below are
 * otherwise identical. Data-layer types (queries, mutations, schemas) stay
 * per-table — only the UI is shared.
 */
export type LoreEntityDescriptor<
  TEntity extends LoreEntityBase,
  TCreateInput,
  TUpdateInput,
  TDeleteInput,
  TMutationError,
> = {
  readonly labels: LoreEntityLabels;
  readonly configTab: ConfigTabId;
  readonly loreFieldKeys: readonly string[];
  readonly loreSections: readonly LoreEntityLoreSection[];
  readonly createInputSchema: z.ZodTypeAny;
  readonly updateInputSchema: z.ZodTypeAny;
  readonly queries: {
    readonly byWorld: (
      worldId: string,
    ) => LoreEntityQueryOptions<readonly TEntity[]>;
    readonly byId: (id: string) => LoreEntityQueryOptions<TEntity | null>;
    readonly usage: (id: string) => LoreEntityQueryOptions<LoreEntityUsage>;
  };
  readonly mutations: {
    readonly create: (args: {
      readonly queryClient: QueryClient;
    }) => UseMutationOptions<
      TEntity,
      AuthUiError | TMutationError,
      TCreateInput
    >;
    readonly update: (args: {
      readonly queryClient: QueryClient;
    }) => UseMutationOptions<
      TEntity,
      AuthUiError | TMutationError,
      TUpdateInput
    >;
    readonly delete: (args: {
      readonly queryClient: QueryClient;
    }) => UseMutationOptions<
      unknown,
      AuthUiError | TMutationError,
      TDeleteInput
    >;
  };
  readonly buildCreateInput: (args: {
    readonly worldId: string;
    readonly name: string;
    readonly description: string;
    readonly color: string;
  }) => TCreateInput;
  readonly buildUpdateInput: (args: {
    readonly id: string;
    readonly worldId: string;
    readonly patch: LoreEntityUpdatePatch;
  }) => TUpdateInput;
  readonly buildDeleteInput: (args: {
    readonly id: string;
    readonly worldId: string;
    readonly reassignToId: string | null;
  }) => TDeleteInput;
  /** Renders a typed router link to the entity's detail page. */
  readonly renderDetailLink: (args: {
    readonly entity: TEntity;
    readonly className?: string;
    readonly children: ReactNode;
  }) => ReactNode;
};
