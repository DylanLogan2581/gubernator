import { z } from "zod";

export const homeDemoSchema = z.object({
  name: z.string().min(1, "Name is required."),
});
