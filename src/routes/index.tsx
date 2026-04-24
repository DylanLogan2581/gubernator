import { createFileRoute } from "@tanstack/react-router";

import { HomePage, preloadHomePage } from "@/features/home";

import type { JSX } from "react";

function HomeRoute(): JSX.Element {
  return <HomePage />;
}

export const Route = createFileRoute("/")({
  loader: ({ context }) => preloadHomePage(context.queryClient),
  component: HomeRoute,
});
