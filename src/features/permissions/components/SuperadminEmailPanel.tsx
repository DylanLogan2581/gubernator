import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { useMemo, useState, type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { nationsListQueryOptions } from "@/features/nations";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { sendEmailMutationOptions } from "../mutations/superadminMutations";
import {
  allUsersForSuperadminQueryOptions,
  allWorldsForSuperadminQueryOptions,
  smtpStatusQueryOptions,
} from "../queries/superadminQueries";

import type {
  SendEmailInput,
  SendEmailKind,
  SendEmailResult,
} from "../types/superadminTypes";

const AUDIENCE_OPTIONS: readonly {
  readonly value: SendEmailKind;
  readonly label: string;
}[] = [
  { label: "All users", value: "all" },
  { label: "Specific users", value: "specific" },
  { label: "World members", value: "world" },
  { label: "Nation members", value: "nation" },
];

export function SuperadminEmailPanel(): JSX.Element {
  const queryClient = useQueryClient();
  const smtpStatusQuery = useQuery(smtpStatusQueryOptions());
  const testMutation = useMutation(sendEmailMutationOptions({ queryClient }));

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
    <>
      <PageHeader
        icon={Mail}
        title="Email"
        description="SMTP status, a test send, and the manual notification sender."
      />

      <div className="mt-6 rounded-lg border border-border p-4">
        <h2 className="text-base font-semibold">SMTP status</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only. Secrets (username, password) are never shown here.
        </p>

        {smtpStatusQuery.isPending && (
          <LoadingState label="Loading SMTP status…" />
        )}

        {smtpStatusQuery.isError && (
          <ErrorState
            title="Could not load SMTP status"
            description={getErrorDescription(smtpStatusQuery.error)}
          />
        )}

        {smtpStatusQuery.isSuccess && (
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Host</dt>
              <dd className="font-medium">{smtpStatusQuery.data.host}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sender name</dt>
              <dd className="font-medium">{smtpStatusQuery.data.senderName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">From address</dt>
              <dd className="font-medium">{smtpStatusQuery.data.adminEmail}</dd>
            </div>
          </dl>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          disabled={testMutation.isPending}
          onClick={handleSendTest}
        >
          Send test email to me
        </Button>
      </div>

      <ManualNotificationForm />
    </>
  );
}

function ManualNotificationForm(): JSX.Element {
  const queryClient = useQueryClient();
  const usersQuery = useQuery(allUsersForSuperadminQueryOptions());
  const worldsQuery = useQuery(allWorldsForSuperadminQueryOptions());

  const [kind, setKind] = useState<SendEmailKind>("all");
  const [selectedUserIds, setSelectedUserIds] = useState<readonly string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [worldId, setWorldId] = useState("");
  const [nationId, setNationId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<SendEmailResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const nationsQuery = useQuery({
    ...nationsListQueryOptions(worldId),
    enabled: worldId !== "",
  });

  const previewMutation = useMutation(
    sendEmailMutationOptions({ queryClient }),
  );
  const sendMutation = useMutation(sendEmailMutationOptions({ queryClient }));
  const isPending = previewMutation.isPending || sendMutation.isPending;

  const filteredUsers = useMemo(() => {
    const users = usersQuery.data ?? [];
    const query = userSearch.trim().toLowerCase();
    if (query === "") return users;
    return users.filter(
      (user) =>
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query),
    );
  }, [usersQuery.data, userSearch]);

  const isAudienceReady =
    kind === "all" ||
    (kind === "specific" && selectedUserIds.length > 0) ||
    (kind === "world" && worldId !== "") ||
    (kind === "nation" && nationId !== "");
  const canPreview =
    isAudienceReady && subject.trim() !== "" && message.trim() !== "";

  function buildInput(dryRun: boolean): SendEmailInput {
    return {
      dryRun,
      kind,
      message,
      nationId: kind === "nation" ? nationId : undefined,
      subject,
      userIds: kind === "specific" ? selectedUserIds : undefined,
      worldId: kind === "world" ? worldId : undefined,
    };
  }

  function handlePreview(): void {
    setPreview(null);
    previewMutation.mutate(buildInput(true), {
      onError: (error) => {
        notifyMutationError(error, "Preview failed");
      },
      onSuccess: (result) => {
        setPreview(result);
      },
    });
  }

  function handleConfirmSend(): void {
    sendMutation.mutate(buildInput(false), {
      onError: (error) => {
        setConfirmOpen(false);
        notifyMutationError(error, "Send failed");
      },
      onSuccess: (result) => {
        setConfirmOpen(false);
        setPreview(null);
        notifyMutationSuccess(
          `Sent to ${result.sentCount} of ${result.recipientCount} recipients.`,
        );
      },
    });
  }

  function toggleUserId(userId: string): void {
    setSelectedUserIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-border p-4">
      <h2 className="text-base font-semibold">Manual notification sender</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Compose a branded email and send it to a chosen audience. Preview before
        sending.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="email-audience">Audience</Label>
          <Select
            value={kind}
            onValueChange={(value) => {
              setKind(value as SendEmailKind);
              setPreview(null);
            }}
          >
            <SelectTrigger id="email-audience" className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUDIENCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {kind === "world" && (
          <div>
            <Label htmlFor="email-world">World</Label>
            <Select
              value={worldId}
              onValueChange={(value) => {
                setWorldId(value);
                setPreview(null);
              }}
            >
              <SelectTrigger id="email-world" className="mt-1 w-full">
                <SelectValue placeholder="Select a world…" />
              </SelectTrigger>
              <SelectContent>
                {(worldsQuery.data ?? []).map((world) => (
                  <SelectItem key={world.id} value={world.id}>
                    {world.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {kind === "nation" && (
          <>
            <div>
              <Label htmlFor="email-nation-world">World</Label>
              <Select
                value={worldId}
                onValueChange={(value) => {
                  setWorldId(value);
                  setNationId("");
                  setPreview(null);
                }}
              >
                <SelectTrigger id="email-nation-world" className="mt-1 w-full">
                  <SelectValue placeholder="Select a world…" />
                </SelectTrigger>
                <SelectContent>
                  {(worldsQuery.data ?? []).map((world) => (
                    <SelectItem key={world.id} value={world.id}>
                      {world.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="email-nation">Nation</Label>
              <Select
                value={nationId}
                disabled={worldId === ""}
                onValueChange={(value) => {
                  setNationId(value);
                  setPreview(null);
                }}
              >
                <SelectTrigger id="email-nation" className="mt-1 w-full">
                  <SelectValue
                    placeholder={
                      worldId === ""
                        ? "Select a world first…"
                        : "Select a nation…"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(nationsQuery.data ?? []).map((nation) => (
                    <SelectItem key={nation.id} value={nation.id}>
                      {nation.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      {kind === "specific" && (
        <div className="mt-4">
          <Label htmlFor="email-user-search">Recipients</Label>
          <Input
            id="email-user-search"
            className="mt-1"
            placeholder="Search by username or email…"
            value={userSearch}
            onChange={(event) => {
              setUserSearch(event.target.value);
            }}
          />
          <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border p-2">
            {filteredUsers.length === 0 && (
              <p className="p-2 text-sm text-muted-foreground">
                No users match.
              </p>
            )}
            {filteredUsers.map((user) => (
              <label
                key={user.id}
                className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/60"
              >
                <Checkbox
                  checked={selectedUserIds.includes(user.id)}
                  onCheckedChange={() => {
                    toggleUserId(user.id);
                    setPreview(null);
                  }}
                />
                <span>{user.username}</span>
                <span className="text-muted-foreground">{user.email}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedUserIds.length} selected
          </p>
        </div>
      )}

      <div className="mt-4">
        <Label htmlFor="email-subject">Subject</Label>
        <Input
          id="email-subject"
          className="mt-1"
          value={subject}
          maxLength={200}
          onChange={(event) => {
            setSubject(event.target.value);
            setPreview(null);
          }}
        />
      </div>

      <div className="mt-4">
        <Label htmlFor="email-message">Message</Label>
        <Textarea
          id="email-message"
          className="mt-1"
          rows={6}
          maxLength={5000}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            setPreview(null);
          }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canPreview || isPending}
          onClick={handlePreview}
        >
          Preview
        </Button>
        {preview !== null && (
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={() => {
              setConfirmOpen(true);
            }}
          >
            Send
          </Button>
        )}
      </div>

      {preview !== null && (
        <div className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium">
            This will reach <strong>{preview.recipientCount}</strong> recipient
            {preview.recipientCount !== 1 ? "s" : ""}.
          </p>
          {preview.renderedHtml !== undefined && (
            <iframe
              title="Email preview"
              srcDoc={preview.renderedHtml}
              className="mt-3 h-96 w-full rounded border border-border bg-white"
              sandbox=""
            />
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Send this email?"
        description={
          preview !== null
            ? `This will send "${subject}" to ${preview.recipientCount} recipient${preview.recipientCount !== 1 ? "s" : ""}.`
            : ""
        }
        confirmLabel="Send"
        confirmVariant="default"
        isPending={sendMutation.isPending}
        onConfirm={handleConfirmSend}
      />
    </div>
  );
}
