import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { queryClient } from "@/lib/queryClient";

import { routeTree } from "./routeTree.gen";
import "./index.css";

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  context: {
    queryClient,
  },
});
const rootElement = document.getElementById("root");

declare module "@tanstack/react-router" {
  // Interface merging is required for TanStack Router module augmentation.
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Register {
    router: typeof router;
  }
}

if (rootElement === null) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
