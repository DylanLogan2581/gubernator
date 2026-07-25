import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  sendEmailMutationOptions,
  updateSmtpSettingsMutationOptions,
} from "../mutations/superadminMutations";
import { smtpStatusQueryOptions } from "../queries/superadminQueries";

import type { SmtpStatus } from "../types/superadminTypes";

export function SmtpSettingsForm(): JSX.Element {
  const queryClient = useQueryClient();
  const smtpStatusQuery = useQuery(smtpStatusQueryOptions());
  const testMutation = useMutation(sendEmailMutationOptions({ queryClient }));

  const isConfigured =
    smtpStatusQuery.isSuccess && smtpStatusQuery.data.configured;

  function handleSendTest(): void {
    testMutation.mutate(
      { kind: "test" },
      {
        onError: (error) => {
          notifyMutationError(error, "Test email failed to send");
        },
        onSuccess: (result) => {
          notifyMutationSuccess(
            result.sentCount > 0
              ? "Test email sent to you."
              : "Test email could not be delivered.",
          );
        },
      },
    );
  }

  return (
    <section className="mt-6">
      <div className="border-b border-border pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">SMTP settings</h2>
            {smtpStatusQuery.isSuccess && smtpStatusQuery.data.configured && (
              <Badge
                variant={
                  smtpStatusQuery.data.source === "database"
                    ? "success"
                    : "outline"
                }
              >
                {smtpStatusQuery.data.source === "database"
                  ? "Database"
                  : "Environment"}
              </Badge>
            )}
            {smtpStatusQuery.isSuccess && !smtpStatusQuery.data.configured && (
              <Badge variant="outline">Not configured</Badge>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={testMutation.isPending || !isConfigured}
            onClick={handleSendTest}
          >
            Send test email to me
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Saved settings are stored in the database and take priority over
          environment variables. The password is write-only and never shown
          here.
        </p>
      </div>

      {smtpStatusQuery.isPending && (
        <LoadingState label="Loading SMTP settings…" />
      )}

      {smtpStatusQuery.isError && (
        <ErrorState
          title="Could not load SMTP settings"
          description={getErrorDescription(smtpStatusQuery.error)}
        />
      )}

      {smtpStatusQuery.isSuccess && !smtpStatusQuery.data.configured && (
        <Alert variant="warning" className="mt-3">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>SMTP not configured</AlertTitle>
          <AlertDescription>
            <p>
              Set the values below, or the equivalent environment variables and
              redeploy the <code>send-email</code> edge function:
            </p>
            <ul className="mt-2 list-inside list-disc text-xs">
              {smtpStatusQuery.data.missing.map((name) => (
                <li key={name} className="font-mono">
                  {name}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {smtpStatusQuery.isSuccess && (
        <SmtpSettingsFields data={smtpStatusQuery.data} />
      )}
    </section>
  );
}

function SmtpSettingsFields({
  data,
}: {
  readonly data: SmtpStatus;
}): JSX.Element {
  const queryClient = useQueryClient();
  const updateMutation = useMutation(
    updateSmtpSettingsMutationOptions({ queryClient }),
  );

  const [host, setHost] = useState(data.configured ? data.host : "");
  const [port, setPort] = useState(data.configured ? String(data.port) : "");
  const [username, setUsername] = useState(
    data.configured ? (data.username ?? "") : "",
  );
  const [password, setPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState(
    data.configured ? data.adminEmail : "",
  );
  const [senderName, setSenderName] = useState(
    data.configured ? data.senderName : "",
  );

  const hasStoredPassword = data.configured && data.hasPassword;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const portNumber = Number.parseInt(port, 10);

    updateMutation.mutate(
      {
        adminEmail,
        host,
        password: password === "" ? undefined : password,
        port: portNumber,
        senderName,
        username: username === "" ? undefined : username,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Saving SMTP settings failed");
        },
        onSuccess: () => {
          notifyMutationSuccess("SMTP settings saved.");
          setPassword("");
        },
      },
    );
  }

  return (
    <form
      className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
      onSubmit={handleSubmit}
    >
      <div>
        <Label htmlFor="smtp-host">Host</Label>
        <Input
          id="smtp-host"
          className="mt-1"
          required
          value={host}
          onChange={(event) => {
            setHost(event.target.value);
          }}
        />
      </div>
      <div>
        <Label htmlFor="smtp-port">Port</Label>
        <Input
          id="smtp-port"
          className="mt-1"
          type="number"
          min={1}
          max={65535}
          required
          value={port}
          onChange={(event) => {
            setPort(event.target.value);
          }}
        />
      </div>
      <div>
        <Label htmlFor="smtp-username">Username</Label>
        <Input
          id="smtp-username"
          className="mt-1"
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
          }}
        />
      </div>
      <div>
        <Label htmlFor="smtp-password">Password</Label>
        <Input
          id="smtp-password"
          className="mt-1"
          type="password"
          autoComplete="new-password"
          placeholder={hasStoredPassword ? "unchanged" : ""}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />
      </div>
      <div>
        <Label htmlFor="smtp-admin-email">From address</Label>
        <Input
          id="smtp-admin-email"
          className="mt-1"
          type="email"
          required
          value={adminEmail}
          onChange={(event) => {
            setAdminEmail(event.target.value);
          }}
        />
      </div>
      <div>
        <Label htmlFor="smtp-sender-name">Sender name</Label>
        <Input
          id="smtp-sender-name"
          className="mt-1"
          required
          value={senderName}
          onChange={(event) => {
            setSenderName(event.target.value);
          }}
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={updateMutation.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}
