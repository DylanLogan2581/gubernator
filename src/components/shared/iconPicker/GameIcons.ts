import { addCollection, Icon as IconifyIcon } from "@iconify/react";
import { CircleHelp, type LucideIcon } from "lucide-react";
import { createElement, useEffect, useState, type JSX } from "react";

import type { IconifyJSON } from "@iconify/types";

/**
 * Namespace prefix stored in the `icon` text column for game-icons.net
 * entries (e.g. `"game:thrown-spear"`), so existing rows holding a bare
 * Lucide name (e.g. `"wheat"`) keep resolving through `CuratedIcons.ts`
 * unchanged — see `resolveEntityIcon`.
 */
export const GAME_ICON_PREFIX = "game:";

/** The prefix used internally by the bundled Iconify collection JSON. */
const ICONIFY_COLLECTION_PREFIX = "game-icons";

export function isGameIconName(name: string): boolean {
  return name.startsWith(GAME_ICON_PREFIX);
}

export function toGameIconName(bareName: string): string {
  return `${GAME_ICON_PREFIX}${bareName}`;
}

export function bareGameIconName(name: string): string {
  return name.slice(GAME_ICON_PREFIX.length);
}

let gameIconsData: IconifyJSON | null = null;
let gameIconsPromise: Promise<IconifyJSON> | null = null;

/**
 * Lazily loads the full game-icons.net collection (bundled offline via
 * `@iconify-json/game-icons`, ~4100 icons, CC BY 3.0) as its own chunk via
 * dynamic `import()` — the picker only pays for it once a user opens the
 * "Game Icons" tab, so it never lands in the main bundle. Registers the
 * data with Iconify's offline store so `<Icon icon="game-icons:x" />`
 * resolves locally, without a network request.
 */
export function loadGameIconsData(): Promise<IconifyJSON> {
  if (gameIconsData !== null) {
    return Promise.resolve(gameIconsData);
  }
  gameIconsPromise ??= import("@iconify-json/game-icons/icons.json").then(
    (module) => {
      const data = module.default as IconifyJSON;
      addCollection(data);
      gameIconsData = data;
      return data;
    },
  );
  return gameIconsPromise;
}

export function isGameIconsDataLoaded(): boolean {
  return gameIconsData !== null;
}

export function getGameIconNames(): readonly string[] {
  return gameIconsData === null ? [] : Object.keys(gameIconsData.icons);
}

/** Whether a bare game-icons.net name exists in the loaded collection. */
function isKnownGameIconName(bareName: string): boolean {
  if (gameIconsData === null) {
    return false;
  }
  return (
    bareName in gameIconsData.icons || bareName in (gameIconsData.aliases ?? {})
  );
}

/**
 * Coarse, keyword-derived categories for the game-icons.net set. The
 * upstream collection ships no per-icon category metadata offline, so
 * grouping is a heuristic over each icon's kebab-case name — good enough
 * for narrowing a 4000+ icon grid, not an authoritative taxonomy.
 */
export const GAME_ICON_CATEGORIES: readonly {
  readonly label: string;
  readonly keywords: readonly string[];
}[] = [
  {
    label: "Resources",
    keywords: [
      "ore",
      "gem",
      "crystal",
      "wood",
      "log",
      "stone",
      "rock",
      "wheat",
      "crop",
      "grain",
      "gold",
      "silver",
      "iron",
      "coal",
      "seed",
      "fruit",
      "berry",
      "oil",
      "coin",
      "resin",
    ],
  },
  {
    label: "Animals",
    keywords: [
      "cow",
      "pig",
      "sheep",
      "horse",
      "chicken",
      "wolf",
      "bear",
      "deer",
      "fish",
      "bird",
      "goat",
      "rabbit",
      "fox",
      "boar",
      "ram",
      "bull",
      "snake",
      "spider",
      "bee",
      "bat",
      "owl",
    ],
  },
  {
    label: "Plants & Nature",
    keywords: [
      "tree",
      "leaf",
      "leaves",
      "mountain",
      "river",
      "cave",
      "forest",
      "cloud",
      "sun",
      "moon",
      "flower",
      "plant",
      "root",
      "vine",
      "grass",
      "water",
      "fire",
      "wave",
      "island",
    ],
  },
  {
    label: "Buildings",
    keywords: [
      "house",
      "castle",
      "tower",
      "barn",
      "mill",
      "hut",
      "temple",
      "wall",
      "gate",
      "bridge",
      "farm",
      "village",
      "camp",
      "tent",
      "church",
      "gazebo",
      "lighthouse",
      "windmill",
    ],
  },
  {
    label: "Tools",
    keywords: [
      "axe",
      "hammer",
      "pickaxe",
      "saw",
      "shovel",
      "hoe",
      "wrench",
      "anvil",
      "hook",
      "ladder",
      "key",
      "lock",
      "scissors",
      "brush",
      "needle",
    ],
  },
  {
    label: "Weapons & Armor",
    keywords: [
      "sword",
      "bow",
      "spear",
      "shield",
      "dagger",
      "mace",
      "crossbow",
      "armor",
      "helmet",
      "gauntlet",
      "arrow",
      "blade",
      "musket",
      "cannon",
    ],
  },
  {
    label: "People & Creatures",
    keywords: [
      "person",
      "worker",
      "knight",
      "farmer",
      "miner",
      "wizard",
      "king",
      "queen",
      "dwarf",
      "elf",
      "orc",
      "dragon",
      "ghost",
      "skull",
      "skeleton",
      "monk",
      "warrior",
    ],
  },
];

export function categorizeGameIconName(name: string): string {
  const category = GAME_ICON_CATEGORIES.find(({ keywords }) =>
    keywords.some((keyword) => name.includes(keyword)),
  );
  return category?.label ?? "Other";
}

const gameIconComponentCache = new Map<string, LucideIcon>();

/**
 * Builds (and caches, keyed by bare icon name) a component with the same
 * shape `resolveEntityIcon` normally returns — so game-icons.net entries
 * flow through the exact same `IconChip` rendering path as curated Lucide
 * icons, without `IconChip` or any of its call sites knowing the
 * difference. Renders a placeholder glyph until the offline collection
 * data has loaded.
 */
export function createGameIconComponent(bareName: string): LucideIcon {
  const cached = gameIconComponentCache.get(bareName);
  if (cached !== undefined) {
    return cached;
  }

  // Bound per bare icon name and cached above, so this only ever runs once
  // per distinct icon rather than on every render.
  // eslint-disable-next-line @eslint-react/component-hook-factories
  function GameIconGlyph({ className }: { className?: string }): JSX.Element {
    const [ready, setReady] = useState(() => isGameIconsDataLoaded());

    useEffect(() => {
      if (ready) {
        return;
      }
      let cancelled = false;
      void loadGameIconsData().then(() => {
        if (!cancelled) {
          setReady(true);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [ready]);

    if (!ready || !isKnownGameIconName(bareName)) {
      return createElement(CircleHelp, { className });
    }
    return createElement(IconifyIcon, {
      icon: `${ICONIFY_COLLECTION_PREFIX}:${bareName}`,
      className,
    });
  }

  const component = GameIconGlyph as unknown as LucideIcon;
  gameIconComponentCache.set(bareName, component);
  return component;
}
