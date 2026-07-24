import { Link } from "@tanstack/react-router";

import type { LoreEntityDescriptor } from "@/features/worlds";

import {
  createReligionMutationOptions,
  deleteReligionMutationOptions,
  updateReligionMutationOptions,
} from "../mutations/religionsMutations";
import {
  religionByIdQueryOptions,
  religionUsageQueryOptions,
  religionsByWorldQueryOptions,
} from "../queries/religionsQueries";
import {
  createReligionInputSchema,
  updateReligionInputSchema,
} from "../schemas/religionSchemas";
import { RELIGION_LORE_FIELD_KEYS } from "../types/religionTypes";

import { RELIGION_LORE_SECTIONS } from "./ReligionLoreSections";

import type { ReligionMutationError } from "../mutations/religionsMutations";
import type {
  CreateReligionInput,
  DeleteReligionInput,
  UpdateReligionInput,
} from "../schemas/religionSchemas";
import type { Religion } from "../types/religionTypes";

type ReligionLoreEntityDescriptor = LoreEntityDescriptor<
  Religion,
  CreateReligionInput,
  UpdateReligionInput,
  DeleteReligionInput,
  ReligionMutationError
>;

export const religionDescriptor: ReligionLoreEntityDescriptor = {
  buildCreateInput: ({ color, description, name, worldId }) => ({
    color,
    description,
    name,
    worldId,
  }),
  buildDeleteInput: ({ id, reassignToId, worldId }) => ({
    reassignToId,
    religionId: id,
    worldId,
  }),
  buildUpdateInput: ({ id, patch, worldId }) => ({
    religionId: id,
    worldId,
    ...patch,
  }),
  configTab: "religions",
  createInputSchema: createReligionInputSchema,
  labels: {
    plural: "religions",
    pluralCapital: "Religions",
    singular: "religion",
    singularCapital: "Religion",
  },
  loreFieldKeys: RELIGION_LORE_FIELD_KEYS,
  loreSections: RELIGION_LORE_SECTIONS,
  // TanStack option generics are invariant in their query-key/result params;
  // the per-table factories are structurally identical to the descriptor
  // shape apart from those params, so cast at this thin wiring boundary.
  mutations: {
    create: createReligionMutationOptions,
    delete: deleteReligionMutationOptions,
    update: updateReligionMutationOptions,
  } as unknown as ReligionLoreEntityDescriptor["mutations"],
  queries: {
    byId: religionByIdQueryOptions,
    byWorld: religionsByWorldQueryOptions,
    usage: religionUsageQueryOptions,
  } as unknown as ReligionLoreEntityDescriptor["queries"],
  renderDetailLink: ({ children, className, entity }) => (
    <Link
      className={className}
      params={{ religionId: entity.id, worldId: entity.worldId }}
      to="/worlds/$worldId/configuration/religions/$religionId"
    >
      {children}
    </Link>
  ),
  updateInputSchema: updateReligionInputSchema,
};
