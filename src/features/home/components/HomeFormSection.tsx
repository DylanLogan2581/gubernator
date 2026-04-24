import { useForm } from "@tanstack/react-form";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { homeDemoSchema } from "../schemas/homeDemoSchema";

import type { JSX } from "react";

function getErrorText(errors: unknown[]): string {
  return errors
    .map((error) => {
      if (typeof error === "string") {
        return error;
      }

      if (error !== null && typeof error === "object" && "message" in error) {
        const message = error.message;
        return typeof message === "string" ? message : "Invalid value.";
      }

      return "Invalid value.";
    })
    .join(", ");
}

export function HomeFormSection(): JSX.Element {
  const [submittedName, setSubmittedName] = useState("");
  const form = useForm({
    defaultValues: { name: "" },
    validators: {
      onChange: homeDemoSchema,
    },
    onSubmit: ({ value }) => {
      setSubmittedName(value.name);
    },
  });

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="font-medium">TanStack Form + Zod</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        The schema lives with the feature instead of inside the route file, so
        validation scales cleanly as the page grows.
      </p>

      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Field name="name">
          {(field) => (
            <label className="flex flex-1 flex-col gap-2">
              <span className="text-sm text-muted-foreground">Name</span>
              <Input
                aria-invalid={field.state.meta.errors.length > 0 || undefined}
                name={field.name}
                placeholder="Ada"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              <span className="min-h-5 text-sm text-destructive">
                {getErrorText(field.state.meta.errors)}
              </span>
            </label>
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button className="sm:mt-7" disabled={!canSubmit}>
              {isSubmitting ? "Saving..." : "Submit"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <p className="mt-3 text-sm text-muted-foreground">
        Submitted value: {submittedName !== "" ? submittedName : "Nothing yet."}
      </p>
    </section>
  );
}
