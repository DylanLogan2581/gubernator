import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "@/features/home";

import type { JSX } from "react";

function HomeRoute(): JSX.Element {
  return <HomePage />;
}

export const Route = createFileRoute("/")({
  component: HomeRoute,
});
