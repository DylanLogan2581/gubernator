import { createFileRoute, useRouter } from "@tanstack/react-router";
import { type JSX } from "react";

import { LoadingState } from "@/components/shared/LoadingState";
import { SetPasswordPage } from "@/features/auth";

function SetPasswordRoute(): JSX.Element {
  const router = useRouter();

  return (
    <SetPasswordPage
      onPasswordSetSuccess={async () => {
        await router.navigate({ to: "/" });
      }}
    />
  );
}

export const Route = createFileRoute("/auth/set-password")({
  component: SetPasswordRoute,
  pendingComponent: (): JSX.Element => <LoadingState label="Loading…" />,
});
