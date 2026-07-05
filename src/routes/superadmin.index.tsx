import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/superadmin/")({
  beforeLoad: () => {
    return redirect({ to: "/superadmin/users" });
  },
});
