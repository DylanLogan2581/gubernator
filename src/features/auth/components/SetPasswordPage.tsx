import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePasswordMutationOptions } from "@/features/auth";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

type SetPasswordPageProps = {
  readonly onPasswordSetSuccess: () => Promise<void>;
};

export function SetPasswordPage({
  onPasswordSetSuccess,
}: SetPasswordPageProps): JSX.Element {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const { mutate, isPending } = useMutation(updatePasswordMutationOptions());

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(undefined);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    mutate(
      { password },
      {
        onError: (err) => {
          const message =
            err.message !== undefined && err.message.length > 0
              ? err.message
              : "Failed to set password";
          setError(message);
          notifyMutationError(err, message);
        },
        onSuccess: () => {
          notifyMutationSuccess("Password set successfully");
          void onPasswordSetSuccess();
        },
      },
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md p-6 bg-card border border-border rounded-lg">
        <h1 className="text-2xl font-bold mb-2">Set Your Password</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Create a password to complete your account setup.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
              placeholder="Minimum 8 characters"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
              }}
              placeholder="Re-enter your password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>

          {error !== undefined && error.length > 0 && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Setting password…" : "Set Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
