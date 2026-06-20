import { createFileRoute } from "@tanstack/react-router";

import { TemplateLibraryPage } from "@/features/worlds";

import type { JSX } from "react";

function SuperadminTemplatesRoute(): JSX.Element {
  return <TemplateLibraryPage />;
}

export const Route = createFileRoute("/superadmin/templates")({
  component: SuperadminTemplatesRoute,
});
