import { z } from "zod";

import { decreeInputLimits } from "@/lib/inputLimits";

const titleSchema = z
  .string()
  .max(decreeInputLimits.titleMax, "Title is too long.")
  .refine((value): boolean => value.trim().length > 0, "Title is required.");

const bodyMarkdownSchema = z
  .string()
  .max(decreeInputLimits.bodyMarkdownMax, "Body is too long.")
  .refine((value): boolean => value.trim().length > 0, "Body is required.");

export const issueDecreeInputSchema = z
  .strictObject({
    bodyMarkdown: bodyMarkdownSchema,
    issuedByCitizenId: z.guid(),
    nationId: z.union([z.guid(), z.null()]),
    settlementId: z.union([z.guid(), z.null()]),
    title: titleSchema,
    worldId: z.guid(),
  })
  .refine(
    (value) => (value.nationId !== null) !== (value.settlementId !== null),
    {
      message: "A decree belongs to exactly one nation or settlement.",
      path: ["nationId"] satisfies PropertyKey[],
    },
  );

export const revokeDecreeInputSchema = z.strictObject({
  id: z.guid(),
});

export type IssueDecreeInput = z.input<typeof issueDecreeInputSchema>;
export type RevokeDecreeInput = z.input<typeof revokeDecreeInputSchema>;
