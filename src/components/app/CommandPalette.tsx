import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Globe2, Landmark, MapPin, Users, Zap } from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type JSX,
  type ReactNode,
} from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandInput,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { citizensInWorldQueryOptions } from "@/features/citizens";
import { nationsListQueryOptions } from "@/features/nations";
import {
  createAccessContext,
  currentAccessContextQueryOptions,
  useActivePlayerCharacter,
  useEffectiveCanAdmin,
} from "@/features/permissions";
import { settlementsByWorldQueryOptions } from "@/features/settlements";
import { accessibleWorldsQueryOptions, WorldAvatar } from "@/features/worlds";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { useAppShellWorldContext } from "./sidebar/UseAppShellWorldContext";
import { useWorldScope } from "./sidebar/WorldScopeContext";
import { useSettlementReadinessAction } from "./UseSettlementReadinessAction";

const DEBOUNCE_MS = 150;
const MAX_RESULTS_PER_GROUP = 8;

type PaletteEntry = {
  readonly disabled?: boolean;
  readonly key: string;
  readonly label: string;
  readonly leading?: ReactNode;
  readonly onSelect: () => void;
  readonly subtitle?: string;
};

type CommandPaletteProps = {
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
};

function filterEntries(
  entries: readonly PaletteEntry[],
  query: string,
): readonly PaletteEntry[] {
  const matching =
    query === ""
      ? entries
      : entries.filter((entry) =>
          `${entry.label} ${entry.subtitle ?? ""}`
            .toLowerCase()
            .includes(query),
        );
  return matching.slice(0, MAX_RESULTS_PER_GROUP);
}

// Global ⌘K / Ctrl+K jump palette (docs/ui-redesign.md §3.2): search worlds,
// nations, settlements, and citizens in the current world, plus quick
// actions gated by the same permission hooks as their always-visible
// header/sidebar equivalents (switch character, mark settlement ready, end
// turn). Mounted once in AppLayout so it works from any route; the header's
// search button and the global ⌘K shortcut both open the same instance.
export function CommandPalette({
  onOpenChange,
  open,
}: CommandPaletteProps): JSX.Element {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, DEBOUNCE_MS)
    .trim()
    .toLowerCase();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { canAdmin, worldId } = useAppShellWorldContext();
  const effectiveCanAdmin = useEffectiveCanAdmin(canAdmin);
  const { nationId, settlementId } = useWorldScope();
  const { activeCharacter, clear, selectableCharacters, switchTo } =
    useActivePlayerCharacter();

  // Built lazily (not a module-level constant) since worlds/permissions
  // barrels import each other — see WorldSwitcher for the same pattern.
  const pendingAccessContext = useMemo(
    () =>
      createAccessContext({
        isSuperAdmin: false,
        userId: null,
        worldAdminWorldIds: [],
      }),
    [],
  );
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );
  const accessContext = accessContextQuery.data;
  const worldsQuery = useQuery({
    ...accessibleWorldsQueryOptions(accessContext ?? pendingAccessContext),
    enabled: open && accessContext !== undefined,
  });
  const nationsQuery = useQuery({
    ...nationsListQueryOptions(worldId ?? ""),
    enabled: open && worldId !== null,
  });
  const settlementsQuery = useQuery({
    ...settlementsByWorldQueryOptions(worldId ?? ""),
    enabled: open && worldId !== null,
  });
  const citizensQuery = useQuery({
    ...citizensInWorldQueryOptions(worldId ?? ""),
    enabled: open && worldId !== null,
  });

  const readinessAction = useSettlementReadinessAction({
    canAdmin: effectiveCanAdmin,
    enabled:
      open && worldId !== null && nationId !== null && settlementId !== null,
    nationId: nationId ?? "",
    settlementId: settlementId ?? "",
    worldId: worldId ?? "",
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onOpenChange, open]);

  function closeAndReset(): void {
    setSearch("");
    onOpenChange(false);
  }

  const hasCharacterSwitcher =
    selectableCharacters.length + (canAdmin ? 1 : 0) > 1;

  const actionEntries: PaletteEntry[] = [];

  if (hasCharacterSwitcher) {
    if (canAdmin) {
      actionEntries.push({
        disabled: activeCharacter === null,
        key: "switch-admin",
        label: "Switch to: Admin",
        onSelect: () => {
          closeAndReset();
          clear();
        },
      });
    }
    for (const candidate of selectableCharacters) {
      actionEntries.push({
        disabled: candidate.id === activeCharacter?.id,
        key: `switch-${candidate.id}`,
        label: `Switch to: ${candidate.name}`,
        onSelect: () => {
          closeAndReset();
          switchTo(candidate.id);
        },
      });
    }
  }

  if (readinessAction.isVisible && readinessAction.item !== null) {
    const readinessItem = readinessAction.item;
    actionEntries.push({
      disabled: readinessAction.isToggleDisabled,
      key: "mark-settlement-ready",
      label: readinessItem.isReadyForCurrentTurn
        ? `Ready ✓ — ${readinessItem.name}`
        : `Mark ${readinessItem.name} ready`,
      onSelect: () => {
        closeAndReset();
        readinessAction.toggle();
      },
    });
  }

  if (effectiveCanAdmin && worldId !== null) {
    actionEntries.push({
      key: "end-turn",
      label: "End turn",
      onSelect: () => {
        closeAndReset();
        // Bridges to EndTurnControl's own button (see its
        // data-command-palette-action attribute) so the confirmation
        // dialog / readiness / stuck-transition logic isn't duplicated.
        document
          .querySelector<HTMLButtonElement>(
            '[data-command-palette-action="end-turn"]',
          )
          ?.click();
      },
    });
  }

  const goToEntries: PaletteEntry[] = [
    {
      key: "go-to-notifications",
      label: "Go to notifications",
      onSelect: () => {
        closeAndReset();
        void navigate({ to: "/notifications" });
      },
    },
  ];

  if (worldId !== null && canAdmin) {
    goToEntries.push({
      key: "go-to-configuration",
      label: "Go to configuration",
      onSelect: () => {
        closeAndReset();
        void navigate({
          params: { worldId },
          search: { tab: "resources" },
          to: "/worlds/$worldId/configuration",
        });
      },
    });
  }

  const worldEntries: PaletteEntry[] = (worldsQuery.data ?? []).map(
    (world) => ({
      key: `world-${world.id}`,
      label: world.name,
      leading: (
        <WorldAvatar
          className="absolute left-2 size-5 translate-y-1/2"
          size="sm"
          thumbnailPath={world.thumbnailPath}
          worldId={world.id}
          worldName={world.name}
        />
      ),
      onSelect: () => {
        closeAndReset();
        void navigate({
          params: { worldId: world.id },
          to: "/worlds/$worldId",
        });
      },
      subtitle: `Turn ${world.currentTurnNumber} · ${world.inWorldDateLabel}`,
    }),
  );

  const nationEntries: PaletteEntry[] =
    worldId === null
      ? []
      : (nationsQuery.data ?? []).map((nation) => ({
          key: `nation-${nation.id}`,
          label: nation.name,
          onSelect: () => {
            closeAndReset();
            void navigate({
              params: { nationId: nation.id, worldId },
              to: "/worlds/$worldId/nations/$nationId",
            });
          },
        }));

  const settlementEntries: PaletteEntry[] =
    worldId === null
      ? []
      : (settlementsQuery.data ?? []).map((settlement) => ({
          key: `settlement-${settlement.id}`,
          label: settlement.name,
          onSelect: () => {
            closeAndReset();
            void navigate({
              params: {
                nationId: settlement.nationId,
                settlementId: settlement.id,
                worldId,
              },
              to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId",
            });
          },
          subtitle: settlement.nationName,
        }));

  const citizenEntries: PaletteEntry[] =
    worldId === null
      ? []
      : (citizensQuery.data ?? []).map((citizen) => ({
          key: `citizen-${citizen.id}`,
          label: citizen.name,
          onSelect: () => {
            closeAndReset();
            void navigate({
              params: { citizenId: citizen.id, worldId },
              to: "/worlds/$worldId/citizens/$citizenId",
            });
          },
          subtitle:
            citizen.citizenType === "player_character"
              ? "Player character"
              : "NPC",
        }));

  const filteredActions = filterEntries(actionEntries, debouncedSearch);
  const filteredGoTo = filterEntries(goToEntries, debouncedSearch);
  const filteredWorlds = filterEntries(worldEntries, debouncedSearch);
  const filteredNations = filterEntries(nationEntries, debouncedSearch);
  const filteredSettlements = filterEntries(settlementEntries, debouncedSearch);
  const filteredCitizens = filterEntries(citizenEntries, debouncedSearch);

  const isLoadingEntities =
    open &&
    (worldsQuery.isPending ||
      (worldId !== null &&
        (nationsQuery.isPending ||
          settlementsQuery.isPending ||
          citizensQuery.isPending)));

  const totalResults =
    filteredActions.length +
    filteredGoTo.length +
    filteredWorlds.length +
    filteredNations.length +
    filteredSettlements.length +
    filteredCitizens.length;

  const showEmptyState =
    !isLoadingEntities && debouncedSearch !== "" && totalResults === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          onOpenChange(true);
          return;
        }
        closeAndReset();
      }}
    >
      <DialogContent className="overflow-hidden p-0 shadow-lg sm:max-w-xl">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Jump to a world, nation, settlement, or citizen, or run an action.
        </DialogDescription>
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group]:overflow-hidden [&_[cmdk-group]]:px-2 [&_[cmdk-group]]:py-1.5 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:absolute [&_[cmdk-item]_svg]:left-2 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5 [&_[cmdk-item]_svg]:translate-y-1/2 [&_[cmdk-item]]:pl-8 [&_[cmdk-item]]:aria-selected:bg-accent [&_[cmdk-item]]:aria-selected:text-accent-foreground [&_[cmdk-empty]]:px-2 [&_[cmdk-empty]]:py-6 [&_[cmdk-empty]]:text-center [&_[cmdk-empty]]:text-sm [&_[cmdk-empty]]:text-muted-foreground"
        >
          <CommandInput
            onValueChange={setSearch}
            placeholder="Jump to a world, nation, settlement, citizen…"
            value={search}
          />
          <CommandList>
            {isLoadingEntities ? <CommandPaletteSkeleton /> : null}
            {showEmptyState ? (
              <CommandEmpty>No results for "{search.trim()}".</CommandEmpty>
            ) : null}
            <PaletteGroup
              entries={filteredActions}
              icon={Zap}
              title="Actions"
            />
            <PaletteGroup
              entries={filteredGoTo}
              icon={ArrowRight}
              title="Go to"
            />
            <PaletteGroup
              entries={filteredWorlds}
              icon={Globe2}
              title="Worlds"
            />
            <PaletteGroup
              entries={filteredNations}
              icon={Landmark}
              title="Nations"
            />
            <PaletteGroup
              entries={filteredSettlements}
              icon={MapPin}
              title="Settlements"
            />
            <PaletteGroup
              entries={filteredCitizens}
              icon={Users}
              title="Citizens"
            />
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function CommandPaletteSkeleton(): JSX.Element {
  return (
    <div
      className="grid gap-2 p-2"
      aria-hidden="true"
      data-testid="command-palette-skeleton"
    >
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-3/4" />
    </div>
  );
}

function PaletteGroup({
  entries,
  icon,
  title,
}: {
  readonly entries: readonly PaletteEntry[];
  readonly icon: ComponentType<{ readonly "aria-hidden"?: boolean }>;
  readonly title: string;
}): JSX.Element | null {
  if (entries.length === 0) {
    return null;
  }

  const Icon = icon;

  return (
    <CommandGroup heading={title}>
      {entries.map((entry) => (
        <CommandItem
          disabled={entry.disabled}
          key={entry.key}
          onSelect={entry.onSelect}
          value={entry.key}
        >
          {entry.leading ?? <Icon aria-hidden />}
          <span className="flex-1 truncate">{entry.label}</span>
          {entry.subtitle !== undefined ? (
            <span className="ml-2 shrink-0 truncate text-xs text-muted-foreground">
              {entry.subtitle}
            </span>
          ) : null}
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
