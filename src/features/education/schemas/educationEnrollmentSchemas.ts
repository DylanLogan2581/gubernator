import { z } from "zod";

export const enrollCitizenInputSchema = z.strictObject({
  citizenId: z.guid("Select a citizen."),
  settlementBuildingId: z.guid("Select a school."),
});

export type EnrollCitizenInput = z.input<typeof enrollCitizenInputSchema>;
export type EnrollCitizenValues = z.output<typeof enrollCitizenInputSchema>;

export const unenrollCitizenInputSchema = z.strictObject({
  enrollmentId: z.guid("Select an enrollment."),
});

export type UnenrollCitizenInput = z.input<typeof unenrollCitizenInputSchema>;
export type UnenrollCitizenValues = z.output<typeof unenrollCitizenInputSchema>;
