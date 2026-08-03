import { Link } from "@tanstack/react-router";

import type { LoreEntityDescriptor } from "@/features/worlds";

import {
  createCultureMutationOptions,
  deleteCultureMutationOptions,
  updateCultureMutationOptions,
} from "../mutations/culturesMutations";
import {
  cultureByIdQueryOptions,
  cultureUsageQueryOptions,
  culturesByWorldQueryOptions,
} from "../queries/culturesQueries";
import {
  createCultureInputSchema,
  updateCultureInputSchema,
} from "../schemas/cultureSchemas";
import { CULTURE_LORE_FIELD_KEYS } from "../types/cultureTypes";

import { CULTURE_LORE_SECTIONS } from "./CultureLoreSections";

import type { CultureMutationError } from "../mutations/culturesMutations";
import type {
  CreateCultureInput,
  DeleteCultureInput,
  UpdateCultureInput,
} from "../schemas/cultureSchemas";
import type { Culture } from "../types/cultureTypes";

type CultureLoreEntityDescriptor = LoreEntityDescriptor<
  Culture,
  CreateCultureInput,
  UpdateCultureInput,
  DeleteCultureInput,
  CultureMutationError
>;

export const cultureDescriptor: CultureLoreEntityDescriptor = {
  buildCreateInput: ({ color, description, name, worldId }) => ({
    color,
    description,
    name,
    worldId,
  }),
  buildDeleteInput: ({ id, reassignToId, worldId }) => ({
    cultureId: id,
    reassignToId,
    worldId,
  }),
  buildUpdateInput: ({ id, patch, worldId }) => ({
    cultureId: id,
    worldId,
    ...patch,
  }),
  configTab: "cultures",
  createInputSchema: createCultureInputSchema,
  labels: {
    plural: "cultures",
    pluralCapital: "Cultures",
    singular: "culture",
    singularCapital: "Culture",
  },
  loreFieldKeys: CULTURE_LORE_FIELD_KEYS,
  loreSections: CULTURE_LORE_SECTIONS,
  // TanStack option generics are invariant in their query-key/result params;
  // the per-table factories are structurally identical to the descriptor
  // shape apart from those params, so cast at this thin wiring boundary.
  mutations: {
    create: createCultureMutationOptions,
    delete: deleteCultureMutationOptions,
    update: updateCultureMutationOptions,
  } as unknown as CultureLoreEntityDescriptor["mutations"],
  queries: {
    byId: cultureByIdQueryOptions,
    byWorld: culturesByWorldQueryOptions,
    usage: cultureUsageQueryOptions,
  } as unknown as CultureLoreEntityDescriptor["queries"],
  renderDetailLink: ({ children, className, entity }) => (
    <Link
      className={className}
      params={{ cultureId: entity.id, worldId: entity.worldId }}
      to="/worlds/$worldId/configuration/cultures/$cultureId"
    >
      {children}
    </Link>
  ),
  updateInputSchema: updateCultureInputSchema,
};
