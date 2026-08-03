import { useState, type JSX } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GovernmentBody } from "@/features/government-bodies";
import { formatNationOfficeType } from "@/features/nations";
import type { OfficeType } from "@/features/nations";
import {
  validateAmendmentProcedure,
  VOTE_THRESHOLDS,
  type AmendmentProcedure,
  type VoteThreshold,
} from "@/shared/government";

type ProcedureKindDraft = "decree" | "vote" | "locked";

const THRESHOLD_LABELS: Readonly<Record<VoteThreshold, string>> = {
  majority: "Majority",
  two_thirds: "Two-thirds",
  three_quarters: "Three-quarters",
  unanimous: "Unanimous",
};

const NONE_BODY_VALUE = "__none__";

// The set_procedure op's own inline builder (#1120), kept behind the
// composer's "Advanced" disclosure. Emits a validated AmendmentProcedure (or
// null while the draft is incomplete/invalid) so the composer can gate
// adding the operation on validateAmendmentProcedure passing, same
// validation the propose_law_amendment RPC's later set_procedure apply uses.
export function SetProcedureEditor({
  bodies,
  officeTypes,
  onChange,
}: {
  readonly bodies: readonly GovernmentBody[];
  readonly officeTypes: readonly OfficeType[];
  readonly onChange: (procedure: AmendmentProcedure | null) => void;
}): JSX.Element {
  const [kind, setKind] = useState<ProcedureKindDraft>("decree");
  const [authorityKind, setAuthorityKind] = useState<"ruler" | "office">(
    "ruler",
  );
  const [officeTypeId, setOfficeTypeId] = useState(officeTypes[0]?.id ?? "");
  const [bodyId, setBodyId] = useState(bodies[0]?.id ?? "");
  const [secondBodyId, setSecondBodyId] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<VoteThreshold>("majority");
  const [votingPeriodTurns, setVotingPeriodTurns] = useState("10");

  function emit(next: unknown): void {
    try {
      onChange(validateAmendmentProcedure(next));
    } catch {
      onChange(null);
    }
  }

  // Simplest correct approach given several independent controls that each
  // need to re-validate the whole procedure: recompute on every change
  // handler using the new value directly instead of relying on state that
  // hasn't re-rendered yet.
  function handleKindChange(next: ProcedureKindDraft): void {
    setKind(next);
    emit(
      next === "locked"
        ? { kind: "locked" }
        : next === "decree"
          ? {
              kind: "decree",
              authority: authorityKind === "ruler" ? "ruler" : { officeTypeId },
            }
          : {
              kind: "vote",
              bodyId,
              threshold,
              votingPeriodTurns: Number(votingPeriodTurns),
              secondBodyId,
            },
    );
  }

  function handleAuthorityKindChange(next: "ruler" | "office"): void {
    setAuthorityKind(next);
    emit({
      kind: "decree",
      authority: next === "ruler" ? "ruler" : { officeTypeId },
    });
  }

  function handleOfficeTypeIdChange(next: string): void {
    setOfficeTypeId(next);
    emit({ kind: "decree", authority: { officeTypeId: next } });
  }

  function handleBodyIdChange(next: string): void {
    setBodyId(next);
    emit({
      kind: "vote",
      bodyId: next,
      threshold,
      votingPeriodTurns: Number(votingPeriodTurns),
      secondBodyId,
    });
  }

  function handleSecondBodyIdChange(next: string): void {
    const nextSecondBodyId = next === NONE_BODY_VALUE ? null : next;
    setSecondBodyId(nextSecondBodyId);
    emit({
      kind: "vote",
      bodyId,
      threshold,
      votingPeriodTurns: Number(votingPeriodTurns),
      secondBodyId: nextSecondBodyId,
    });
  }

  function handleThresholdChange(next: VoteThreshold): void {
    setThreshold(next);
    emit({
      kind: "vote",
      bodyId,
      threshold: next,
      votingPeriodTurns: Number(votingPeriodTurns),
      secondBodyId,
    });
  }

  function handleVotingPeriodTurnsChange(next: string): void {
    setVotingPeriodTurns(next);
    emit({
      kind: "vote",
      bodyId,
      threshold,
      votingPeriodTurns: Number(next),
      secondBodyId,
    });
  }

  return (
    <div className="grid gap-2">
      <div className="grid gap-1">
        <Label>New procedure kind</Label>
        <Select value={kind} onValueChange={handleKindChange}>
          <SelectTrigger aria-label="Procedure kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="decree">Decree</SelectItem>
            <SelectItem value="vote">Vote</SelectItem>
            <SelectItem value="locked">Locked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {kind === "decree" ? (
        <div className="grid gap-2">
          <RadioGroup
            value={authorityKind}
            onValueChange={(value) =>
              handleAuthorityKindChange(value as "ruler" | "office")
            }
          >
            <Label className="flex items-center gap-2 text-sm font-normal">
              <RadioGroupItem value="ruler" /> The ruler
            </Label>
            <Label className="flex items-center gap-2 text-sm font-normal">
              <RadioGroupItem value="office" /> Holder of an office
            </Label>
          </RadioGroup>
          {authorityKind === "office" ? (
            <Select
              value={officeTypeId}
              onValueChange={handleOfficeTypeIdChange}
            >
              <SelectTrigger aria-label="Authority office">
                <SelectValue placeholder="Select an office" />
              </SelectTrigger>
              <SelectContent>
                {officeTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {formatNationOfficeType(type.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      ) : null}

      {kind === "vote" ? (
        <div className="grid gap-2">
          <div className="grid gap-1">
            <Label>Body</Label>
            <Select value={bodyId} onValueChange={handleBodyIdChange}>
              <SelectTrigger aria-label="Voting body">
                <SelectValue placeholder="Select a body" />
              </SelectTrigger>
              <SelectContent>
                {bodies.map((body) => (
                  <SelectItem key={body.id} value={body.id}>
                    {body.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Second body (optional)</Label>
            <Select
              value={secondBodyId ?? NONE_BODY_VALUE}
              onValueChange={handleSecondBodyIdChange}
            >
              <SelectTrigger aria-label="Second voting body">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_BODY_VALUE}>None</SelectItem>
                {bodies.map((body) => (
                  <SelectItem key={body.id} value={body.id}>
                    {body.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Threshold</Label>
            <Select
              value={threshold}
              onValueChange={(value) =>
                handleThresholdChange(value as VoteThreshold)
              }
            >
              <SelectTrigger aria-label="Threshold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOTE_THRESHOLDS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {THRESHOLD_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="set-procedure-voting-period">
              Voting period (turns)
            </Label>
            <Input
              id="set-procedure-voting-period"
              type="number"
              min={1}
              value={votingPeriodTurns}
              onChange={(e) => handleVotingPeriodTurnsChange(e.target.value)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
