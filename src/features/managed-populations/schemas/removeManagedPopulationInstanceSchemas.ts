import { z } from "zod";

const managedPopulationInstanceIdSchema = z.guid(
  "Managed population instance id must be a valid UUID.",
);

export const removeManagedPopulationInstanceInputSchema = z.strictObject({
  managedPopulationInstanceId: managedPopulationInstanceIdSchema,
});

export type RemoveManagedPopulationInstanceInput = z.input<
  typeof removeManagedPopulationInstanceInputSchema
>;
export type RemoveManagedPopulationInstanceValues = z.output<
  typeof removeManagedPopulationInstanceInputSchema
>;
