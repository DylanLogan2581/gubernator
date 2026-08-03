import { ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState, type JSX } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WorldGeneratedNamingConfig } from "@/lib/worldNamingConfigSchemas";

import { ConventionPicker } from "./ConventionPicker";
import { NameGenerationPreview } from "./NameGenerationPreview";
import {
  isListReferenced,
  MAX_PART_LISTS,
  renameListRefInPatterns,
  sanitizeGeneratedConfig,
  validateGeneratedConfig,
} from "./utils/GeneratedConfigUtils";

type GeneratedPatterns = WorldGeneratedNamingConfig["patterns"];
type GeneratedPatternKey = keyof GeneratedPatterns;
type GeneratedPattern = GeneratedPatterns[GeneratedPatternKey];
type GeneratedPatternElement = GeneratedPattern[number];

const PATTERN_FIELDS: readonly {
  key: GeneratedPatternKey;
  label: string;
  description: string;
}[] = [
  {
    key: "female_given",
    label: "Female given name",
    description: "Composed for each generated female name.",
  },
  {
    key: "male_given",
    label: "Male given name",
    description: "Composed for each generated male name.",
  },
  {
    key: "surname",
    label: "Surname",
    description:
      'Composed when the surname rule below is "Surname pool" (or as a fallback for other rules).',
  },
];

export function GeneratedConfigFields({
  config,
  onChange,
}: {
  readonly config: WorldGeneratedNamingConfig;
  readonly onChange: (config: WorldGeneratedNamingConfig) => void;
}): JSX.Element {
  const [newListName, setNewListName] = useState("");
  const [newListError, setNewListError] = useState<string | undefined>();

  const listNames = Object.keys(config.parts);
  const sanitized = useMemo(() => sanitizeGeneratedConfig(config), [config]);
  const errors = useMemo(() => validateGeneratedConfig(config), [config]);

  function handleAddList(): void {
    const trimmed = newListName.trim();
    if (trimmed.length === 0) {
      setNewListError("List name is required.");
      return;
    }
    if (trimmed in config.parts) {
      setNewListError("A list with this name already exists.");
      return;
    }
    if (listNames.length >= MAX_PART_LISTS) {
      setNewListError(
        `You can have at most ${String(MAX_PART_LISTS)} part lists.`,
      );
      return;
    }
    onChange({ ...config, parts: { ...config.parts, [trimmed]: [] } });
    setNewListName("");
    setNewListError(undefined);
  }

  function handleRenameList(
    oldName: string,
    newName: string,
  ): string | undefined {
    if (newName in config.parts) {
      return "A list with this name already exists.";
    }
    const parts = Object.fromEntries(
      Object.entries(config.parts).map(([key, entries]) => [
        key === oldName ? newName : key,
        entries,
      ]),
    );
    onChange({
      ...config,
      parts,
      patterns: renameListRefInPatterns(config.patterns, oldName, newName),
    });
    return undefined;
  }

  function handleDeleteList(listName: string): void {
    if (isListReferenced(config, listName)) return;
    const parts = Object.fromEntries(
      Object.entries(config.parts).filter(([key]) => key !== listName),
    );
    onChange({ ...config, parts });
  }

  return (
    <div className="grid gap-4">
      {errors.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>Fix the following before saving:</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <fieldset className="grid gap-2">
        <legend className="text-base font-semibold">Part lists</legend>
        <p className="text-xs text-muted-foreground">
          Named fragment lists referenced by the patterns below. One fragment
          per line; duplicate lines weight that fragment more heavily.
        </p>
        <div className="divide-y divide-border border-y border-border">
          {listNames.map((listName) => {
            const referenced = isListReferenced(config, listName);
            return (
              <PartListEditor
                key={listName}
                listName={listName}
                entries={config.parts[listName] ?? []}
                disabledDelete={referenced}
                disabledDeleteReason={
                  referenced
                    ? "Used by a pattern below — remove that reference first."
                    : undefined
                }
                onRename={(newName) => handleRenameList(listName, newName)}
                onEntriesChange={(entries) => {
                  onChange({
                    ...config,
                    parts: { ...config.parts, [listName]: entries },
                  });
                }}
                onDelete={() => {
                  handleDeleteList(listName);
                }}
              />
            );
          })}
        </div>
        <div className="flex items-start gap-2">
          <div className="grid gap-1">
            <Input
              aria-label="New list name"
              className="h-8 w-48"
              placeholder="List name, e.g. onset"
              value={newListName}
              onChange={(event) => {
                setNewListName(event.currentTarget.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddList();
                }
              }}
            />
            {newListError !== undefined ? (
              <p className="text-xs text-destructive">{newListError}</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddList}
          >
            <Plus aria-hidden="true" />
            Add list
          </Button>
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-base font-semibold">Patterns</legend>
        {PATTERN_FIELDS.map((field) => (
          <PatternBuilder
            key={field.key}
            label={field.label}
            description={field.description}
            listNames={listNames}
            pattern={config.patterns[field.key]}
            onChange={(pattern) => {
              onChange({
                ...config,
                patterns: { ...config.patterns, [field.key]: pattern },
              });
            }}
          />
        ))}
      </fieldset>

      <ConventionPicker
        convention={config.convention}
        onChange={(convention) => {
          onChange({ ...config, convention });
        }}
      />

      <NameGenerationPreview config={sanitized} />
    </div>
  );
}

function PartListEditor({
  listName,
  entries,
  disabledDelete,
  disabledDeleteReason,
  onRename,
  onEntriesChange,
  onDelete,
}: {
  readonly listName: string;
  readonly entries: readonly string[];
  readonly disabledDelete: boolean;
  readonly disabledDeleteReason?: string;
  readonly onRename: (newName: string) => string | undefined;
  readonly onEntriesChange: (entries: string[]) => void;
  readonly onDelete: () => void;
}): JSX.Element {
  const [nameDraft, setNameDraft] = useState(listName);
  const [nameError, setNameError] = useState<string | undefined>();
  // Keep the draft in sync with externally-driven renames (e.g. via another
  // list's reference update) during render, matching PoolEditor's pattern.
  const [prevListName, setPrevListName] = useState(listName);
  if (prevListName !== listName) {
    setPrevListName(listName);
    setNameDraft(listName);
  }

  function commitRename(): void {
    const trimmed = nameDraft.trim();
    if (trimmed === listName) {
      setNameDraft(listName);
      setNameError(undefined);
      return;
    }
    if (trimmed.length === 0) {
      setNameError("List name cannot be empty.");
      setNameDraft(listName);
      return;
    }
    if (trimmed.length > 64) {
      setNameError("List name is too long.");
      setNameDraft(listName);
      return;
    }
    const error = onRename(trimmed);
    if (error !== undefined) {
      setNameError(error);
      setNameDraft(listName);
    } else {
      setNameError(undefined);
    }
  }

  const nonBlankCount = entries.filter((entry) => entry.trim() !== "").length;

  return (
    <fieldset className="grid gap-1.5 py-3">
      <div className="flex items-center gap-2">
        <Input
          aria-label="List name"
          className="h-8 max-w-56 font-medium"
          value={nameDraft}
          onChange={(event) => {
            setNameDraft(event.currentTarget.value);
          }}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitRename();
            }
          }}
        />
        <span className="text-xs text-muted-foreground">
          ({String(nonBlankCount)})
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          aria-label={`Delete list ${listName}`}
          disabled={disabledDelete}
          onClick={onDelete}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      {nameError !== undefined ? (
        <p className="text-xs text-destructive">{nameError}</p>
      ) : null}
      {disabledDelete && disabledDeleteReason !== undefined ? (
        <p className="text-xs text-muted-foreground">{disabledDeleteReason}</p>
      ) : null}
      <textarea
        aria-label={`Entries for ${listName}`}
        className="h-28 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm placeholder:text-muted-foreground transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        placeholder="One fragment per line…"
        value={entries.join("\n")}
        onChange={(event) => {
          onEntriesChange(event.currentTarget.value.split("\n"));
        }}
      />
    </fieldset>
  );
}

function PatternBuilder({
  label,
  description,
  listNames,
  pattern,
  onChange,
}: {
  readonly label: string;
  readonly description: string;
  readonly listNames: readonly string[];
  readonly pattern: GeneratedPattern;
  readonly onChange: (pattern: GeneratedPatternElement[]) => void;
}): JSX.Element {
  function updateElement(index: number, value: GeneratedPatternElement): void {
    const next = [...pattern];
    next[index] = value;
    onChange(next);
  }

  function removeElement(index: number): void {
    onChange(pattern.filter((_, i) => i !== index));
  }

  function moveElement(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= pattern.length) return;
    const next = [...pattern];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <fieldset className="grid gap-1.5">
      <legend className="eyebrow w-full border-b border-border pb-1">
        {label}
      </legend>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex min-h-11 flex-wrap items-center gap-1 rounded-md border border-dashed p-2">
        {pattern.length === 0 ? (
          <span className="text-xs italic text-muted-foreground">
            Empty — add text or a list reference.
          </span>
        ) : null}
        {pattern.map((element, index) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- ordered sequence with no other stable identity; reordered in place
          <div key={index} className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Move earlier"
              disabled={index === 0}
              onClick={() => {
                moveElement(index, -1);
              }}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            {Array.isArray(element) ? (
              <span className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">
                {element.join(" + ")}
                <button
                  type="button"
                  aria-label="Remove list reference"
                  onClick={() => {
                    removeElement(index);
                  }}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Input
                  aria-label="Literal text"
                  className="h-7 w-24 text-xs"
                  value={element}
                  onChange={(event) => {
                    updateElement(index, event.currentTarget.value);
                  }}
                />
                <button
                  type="button"
                  aria-label="Remove text"
                  onClick={() => {
                    removeElement(index);
                  }}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Move later"
              disabled={index === pattern.length - 1}
              onClick={() => {
                moveElement(index, 1);
              }}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onChange([...pattern, ""]);
          }}
        >
          <Plus aria-hidden="true" />
          Add text
        </Button>
        <Select
          disabled={listNames.length === 0}
          value=""
          onValueChange={(listName) => {
            onChange([...pattern, [listName]]);
          }}
        >
          <SelectTrigger
            className="h-8 w-40 text-xs"
            aria-label="Add list reference"
          >
            <SelectValue placeholder="Add list ref…" />
          </SelectTrigger>
          <SelectContent>
            {listNames.map((listName) => (
              <SelectItem key={listName} value={listName}>
                {listName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </fieldset>
  );
}
