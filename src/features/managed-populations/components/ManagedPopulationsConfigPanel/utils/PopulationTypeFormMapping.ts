import type { ResourceAmountEntry } from "@/components/shared/ResourceAmountListEditor";
import { generateLocalId } from "@/lib/uid";

export function resourceEntryToDto(entry: ResourceAmountEntry): {
  amountPerNAnimals: number;
  resourceId: string;
} {
  return {
    amountPerNAnimals: parseFloat(entry.amount),
    resourceId: entry.resourceId,
  };
}

export function resourceEntriesToDtoArray(
  entries: ResourceAmountEntry[],
): ReadonlyArray<{
  amountPerNAnimals: number;
  resourceId: string;
}> {
  return entries.map(resourceEntryToDto);
}

export function databaseResourceToEntry(data: {
  amountPerNAnimals: number;
  resourceId: string;
}): ResourceAmountEntry {
  return {
    amount: String(data.amountPerNAnimals),
    id: generateLocalId(),
    resourceId: data.resourceId,
  };
}

export function databaseResourcesToEntries(
  data: readonly {
    amountPerNAnimals: number;
    resourceId: string;
  }[],
): ResourceAmountEntry[] {
  return data.map(databaseResourceToEntry);
}
