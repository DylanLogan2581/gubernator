import { useMutation, type QueryClient } from "@tanstack/react-query";
import { useId, useState, type FormEvent, type JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyMutationSuccess, notifyMutationError } from "@/lib/notify";

import { createUserMutationOptions } from "../mutations/superadminMutations";

import type { CreateUserInput } from "../types/superadminTypes";

export type CreateUserDialogProps = {
  readonly onClose: () => void;
  readonly onCreated: (userId: string) => void;
  readonly queryClient: QueryClient;
};

export function CreateUserDialog({
  onClose,
  onCreated,
  queryClient,
}: CreateUserDialogProps): JSX.Element {
  const emailId = useId();
  const usernameId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sendMagicLink, setSendMagicLink] = useState(false);
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const mutation = useMutation(createUserMutationOptions({ queryClient }));

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFormError(undefined);

    const input: CreateUserInput = {
      email: email.trim(),
      username: username.trim(),
      ...(sendMagicLink ? { sendMagicLink: true } : { password }),
    };

    mutation.mutate(input, {
      onError: (error) => {
        setFormError(error.message);
        notifyMutationError(error, "Failed to create user.");
      },
      onSuccess: (result) => {
        notifyMutationSuccess("User created successfully.", {
          description: `${result.username} (${result.email})`,
        });
        onCreated(result.userId);
        onClose();
      },
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Create a new application user. They will be able to sign in with the
            provided credentials.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={emailId}>Email address</Label>
            <Input
              id={emailId}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
              placeholder="user@example.com"
              required
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={usernameId}>Username</Label>
            <Input
              id={usernameId}
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
              }}
              placeholder="username"
              required
              autoComplete="off"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="send-magic-link"
              checked={sendMagicLink}
              onChange={(e) => {
                setSendMagicLink(e.target.checked);
              }}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="send-magic-link">
              Send magic link instead of setting a password
            </Label>
          </div>

          {!sendMagicLink && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={passwordId}>Temporary password</Label>
              <Input
                id={passwordId}
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                placeholder="Minimum 8 characters"
                minLength={8}
                required={!sendMagicLink}
                autoComplete="new-password"
              />
            </div>
          )}

          {formError !== undefined && (
            <p className="text-sm text-destructive">{formError}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
