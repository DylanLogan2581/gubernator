# UI Redesign: Sidebar-First App Shell

Design doc for restructuring Gubernator's navigation and layout around the shadcn/ui
Sidebar, with a route reorganization, a density pass, and a visual refresh.

Reference mockups live in `mockups/` (temporary). They are directional, not literal —
several mockup pages (quests, schedules, husbandry detail, report builder) exceed the
current feature set and are explicitly out of scope. What we take from them: the
sidebar information architecture, the header pattern, stat-tile density, entity
color/icon usage, and the master-detail (list + side panel) layout.

---

## 1. Goals

1. **One navigation surface.** Move the top nav, world/nation/settlement selection,
   player character selection, and in-page tab strips into a single shadcn sidebar
   with collapsible sections and inline entity switchers.
2. **Denser, more useful views.** Kill the triple-nested `max-w-*` columns and long
   single-column card stacks. Full-width content, stat tiles, tables-first lists,
   two/three-column detail layouts.
3. **Clearer usage.** Every screen answers "where am I, what can I do, what needs my
   attention" without scrolling. Context (world → nation → settlement → character) is
   always visible and always switchable.
4. **Less bland.** Introduce a brand hue, semantic status colors, per-domain icons,
   and entity color coding. (Illustrative imagery like the mockups' building art is a
   later, asset-dependent phase.)
5. **Stay on shadcn.** All new chrome built from shadcn primitives; the only new
   `src/components/ui` additions are `sidebar.tsx` (+ its registry deps we don't have
   yet). No bespoke nav framework.

## 2. Current state (findings)

### 2.1 Navigation is three stacked bars, none of which is a real nav

- `AppHeader` (`src/components/app/AppHeader.tsx`) — logo, tagline, `AuthNavigationControl`
  (Sign in / Worlds / Admin / Sign out), notifications bell. No world context.
- `WorldContextBar` (`src/components/app/WorldContextBar.tsx`) — breadcrumb +
  `ActiveCharacterSwitcher`, rendered by `WorldEntryGate` inside every `/worlds/$worldId/*` page.
- `WorldNav` (`src/features/worlds/components/WorldNav.tsx`) — underline tabs:
  Overview / Events / History / Configuration.

Three bars of vertical chrome before content starts, and _none_ of them lets you jump
to a different world, nation, or settlement directly — switching context means walking
back up through list pages.

### 2.2 Selection is navigation-only

- Worlds: card list at `/worlds`, no persistent switcher.
- Nations/settlements/citizens: reached only via list pages and "Back to …" buttons.
- Citizens have **no list route at all** — a citizen is reachable only through the
  settlement population panel, turn-log links, parent links, or the "My character"
  button. And citizen detail is restricted: non-admins can only view their own living
  PC (`CitizenDetailPage/index.tsx:193-206` redirects everyone else).
- Player character: `ActiveCharacterSwitcher` exists (good) but is buried in the thin
  context bar.

### 2.3 Tabs hide most of the app

- Settlement detail: **7 sections** behind `?section=` (overview, population, economy,
  forecast, reports, admin, history). The economy section alone contains five panels
  the mockups treat as separate pages (buildings, construction, stockpiles, deposits,
  trade routes); managed populations is a sixth, buried in the population section.
  A nested `?assignmentTab=` param is **vestigial** — `SettlementAssignmentBoard`
  accepts and ignores it (bulk/per-target became row kinds inside
  `JobAssignmentsTable`); it should be deleted, not ported.
- World configuration: **10 tabs** behind `?tab=`.
- Nation detail: no tabs at all — ~9 full-width sections stacked vertically
  (details, events, hidden toggle, nameset, settlements, reports, turn log, roles,
  relationships, delete).

### 2.4 Whitespace

- Global shell centers at `max-w-6xl`, then pages re-narrow to `max-w-5xl`/`max-w-4xl`
  with `py-6` (`WorldShellPage.tsx:279`, `WorldConfigurationPage.tsx:109`, etc.).
- Cards use `p-5`/`p-6` with `gap-4`/`gap-6` stacks; grids top out at `sm:grid-cols-2`.
- Decorative gradient/blur blobs in `AppLayout` spend space without carrying info.

### 2.5 What's already in our favor

- `--sidebar*` CSS variables are **already defined** (light + dark) in `src/index.css`
  and mapped in `@theme inline` — the shadcn sidebar drops in with zero theme work.
- Sidebar's registry dependencies (sheet, tooltip, button, separator, skeleton, input)
  all exist in `src/components/ui`.
- `command.tsx` + cmdk exist — a global ⌘K jump palette is nearly free.
- Tab state already lives in zod-validated URL search params, which makes converting
  tabs → routes or tabs → sidebar items mechanical.
- Theme is pure grayscale (`oklch(… 0 0)` everywhere, except destructive/warning/
  success/charts) — a hue can be introduced by editing tokens only, no component
  changes. One stray: dark-mode `--sidebar-primary` is already shadcn's default blue
  (`oklch(0.488 0.243 264)`); fold it into the deliberate palette.
- Turn/date chip data already exists: `worldRouteAccessQueryOptions` carries
  `currentTurnNumber` + `inWorldDateLabel` (`worlds/queries/worldQueries.ts:173-189`),
  and `currentTurnStateQueryOptions(worldId)` returns ready-made
  `displayLabels.turnLabel` / `dateLabel` (`turns/queries/currentTurnStateQueries.ts:56-67`).
- Unread notifications count query already exists for a sidebar badge:
  `unreadNotificationsCountQueryOptions(userId)` (`notificationQueries.ts:135-146`) —
  currently unused; `NotificationsPopover` derives its badge from a heavier list query.

## 3. New app shell

### 3.1 Structure

```
<SidebarProvider>                        // persists open state (cookie), ⌘B toggle
  <AppSidebar />                         // collapsible="icon", variant="inset"
  <SidebarInset>
    <AppHeader />                        // slim: trigger + breadcrumb + turn + actions
    <main className="flex-1 p-4 lg:p-6"> // full width — NO max-w re-narrowing
      <Outlet />
    </main>
  </SidebarInset>
</SidebarProvider>
```

- Base pattern: **shadcn block `sidebar-07`** (icon-collapsible, switcher in header,
  user menu in footer, `SidebarInset` + breadcrumb header). Install via
  `npx shadcn@latest add sidebar-07`, then adapt.
- `collapsible="icon"`: collapsed rail keeps icons + tooltips, so the game stays
  playable on a laptop with the sidebar tucked away.
- Mobile: sidebar renders in a Sheet automatically; the current per-page
  `NativeSelect` tab fallbacks get deleted rather than ported.
- `AppFooter` is removed; its links (if any matter) move to the sidebar footer menu.
- The decorative gradient/blur backdrops in `AppLayout` are removed.

### 3.2 Sidebar contents (in-world)

Mirrors the mockups' grouping, mapped to our actual feature set:

```
┌──────────────────────────────────────────────┐
│ [world icon]  Eldoria              ⌄        │ ← World switcher (SidebarHeader,
│               Turn 47 · Spring, Y12          │   DropdownMenu: accessible worlds,
├──────────────────────────────────────────────┤   "All worlds", "Create world")
│ (avatar) Casia Stonehelm            ⌄        │ ← Character switcher (relocated
│          Settlement Manager · Northwatch     │   ActiveCharacterSwitcher: switch PC,
├──────────────────────────────────────────────┤   clear→admin, admin-paused badge)
│ PLAY                                         │ ← SidebarGroup (collapsible)
│   ◆ Dashboard                                │   /worlds/$worldId
│   ◆ My Character                             │   /worlds/$worldId/citizens/$activePcId
│   ◆ Events                                   │   /worlds/$worldId/events
│   ◆ Notifications                     (3)    │   /notifications  + SidebarMenuBadge
│                                              │
│ SETTLEMENT · Northwatch             ⌄  ⋯     │ ← group label = settlement switcher
│   ◆ Overview                                 │   (dropdown of settlements in scope)
│   ◆ Citizens & Assignments                   │
│   ◆ Buildings                                │
│   ◆ Construction                             │
│   ◆ Stockpiles                               │
│   ◆ Deposits                                 │
│   ◆ Managed Populations                      │
│   ◆ Trade Routes                             │
│   ◆ Forecast                                 │
│   ◆ Reports                                  │
│                                              │
│ NATION · Frostgate Empire           ⌄        │ ← nation switcher in label
│   ◆ Overview                                 │
│   ◆ Settlements                              │
│   ◆ Relationships                            │
│   ◆ Government & Roles                       │
│   ◆ Reports                                  │
│                                              │
│ WORLD                                        │
│   ◆ Nations                                  │
│   ◆ Citizens                                 │   world citizen directory (new)
│   ◆ Turn Log                                 │   (today's "History")
│   ◆ Configuration            ▸               │ ← SidebarMenuSub (collapsible):
│                                              │   Resources, Jobs, Buildings, Deposits,
│ ADMIN                        (permission-    │   Populations, Calendar, Namesets,
│   ◆ World Settings            gated group)   │   NPC Flavor, Population Rules
│   ◆ Superadmin                               │
│   ◆ Template Library                         │
├──────────────────────────────────────────────┤
│ (avatar) user@email                  ⌄       │ ← SidebarFooter: sign out, theme,
└──────────────────────────────────────────────┘   superadmin link
```

Key decisions:

- **Switchers live in the sidebar, three levels deep.**
  - _World_: `SidebarHeader` dropdown (sidebar-07 team-switcher pattern). Second line
    shows turn + calendar date (`inWorldDateLabel` is already on the world query).
    "Create world" / "Import" entries are **superadmin-gated** (matches current
    `WorldListPage` behavior — world creation is not a world-admin capability).
  - _Settlement / Nation_: the group label itself is a `DropdownMenu` trigger listing
    the entities in scope (settlements the active PC can see / nations in world for
    admins). Selecting one navigates to the same sub-page in the new scope when it
    exists, else that scope's overview.
  - _Character_: pinned card under the header — always visible, one click to switch.
    Keeps existing semantics: active PC suppresses admin, "World Admin" / "Admin
    paused" badges preserved.
- **Scope groups are contextual but sticky.** The SETTLEMENT and NATION groups render
  whenever a scope is resolvable, in priority order: current route params → last-viewed
  scope for this world (localStorage — no server-side visit tracking, decided) →
  active character's home settlement (`Citizen.settlementId`; id only — name resolves
  via existing settlement queries). If none resolve (fresh admin, no selection), the
  group collapses to a single "Choose a settlement…" item (or falls back to the first
  settlement in scope if "none" proves annoying).
- **Config's 10 tabs become a `SidebarMenuSub`** under World → Configuration,
  permission-gated as today (world-settings item is super-admin only). The `?tab=`
  URLs keep working; sidebar sub-items link to them and set `isActive` from the
  search param.
- **Badges**: `SidebarMenuBadge` for unread notifications, backed by the existing
  (currently unused) `unreadNotificationsCountQueryOptions` + notifications realtime
  hook. Later candidates — settlements not turn-ready, pending trade approvals.
- **Out-of-world** (`/worlds`, `/superadmin`, `/notifications` with no world): the
  sidebar renders a reduced form — world switcher header ("Select a world"), PLAY
  group with Worlds/Notifications, ADMIN group. Same shell everywhere; no separate
  layout to maintain.
- **⌘K palette** (existing `command.tsx`): global jump — search worlds, nations,
  settlements, citizens; actions like "End turn", "Switch character". Trigger in the
  header (search icon) + keyboard.

### 3.3 New header (inside `SidebarInset`)

One slim row (~48px), replacing all three current bars:

```
[≡ trigger] [breadcrumb: Frostgate Empire › Northwatch › Buildings]        [Turn 47 · Spring, Y12] [End Turn] [🔔] [⌘K]
```

- `SidebarTrigger` + existing `WorldBreadcrumb` (reused, restyled with shadcn
  `breadcrumb.tsx`).
- Right side: turn/date chip, `EndTurnControl` (world admin only — promoted from
  being buried in `WorldShellPage`; the mockups are right that End Turn is the
  primary verb of the whole app), notifications popover, command-palette trigger.
- **Player equivalent of End Turn is readiness**: settlement managers / nation
  managers mark settlements ready (`set_settlement_readiness` RPC; authority via
  `checkCanManageSettlement`). For those users the header shows a "Mark ready" /
  "Ready ✓" chip for the pinned settlement instead of the End Turn button. Admins
  see readiness progress (N/M ready) on the End Turn button as today.
- Logo + product name move into the sidebar header area / footer; the tagline dies.

## 4. Route review and reorganization

Principle: **URL = sidebar item.** Every sidebar entry is a route (or a stable
`?tab=` search param during migration). Big multi-tab pages split into child routes so
the sidebar, breadcrumb, and browser history all agree.

### 4.1 Route changes

| Current                                                                                  | Problem                                                                                | Proposed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/` (`HomePage`)                                                                         | Marketing shell shown to signed-in users                                               | Signed-in → redirect to `/worlds` (or last world). Marketing page stays for signed-out only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `/worlds`                                                                                | Sparse card list                                                                       | Denser: table or compact card grid with world icon/color, planning turn, in-world date, status/visibility badge, your role (Manage/Public badges exist today). No last-played/member-count — that data doesn't exist and we're not adding tracking (decided). Sort stays `updatedAt desc`. Superadmin keeps create/import/trash affordances.                                                                                                                                                                                                                                                                                         |
| `/worlds/$worldId` (`WorldShellPage`)                                                    | Link-card hub, little info                                                             | Real **dashboard**: stat-tile row (turn, nations, settlements, population, unresolved events, turn readiness), readiness table, active events feed, recent turn-log excerpt, End Turn state. Mockup pattern: 5-tile row + content columns.                                                                                                                                                                                                                                                                                                                                                                                           |
| `/worlds/$worldId/nations/$nationId`                                                     | ~11 stacked full-width sections, no tabs                                               | Split into child routes matching the sidebar NATION group: `/` (overview: details, stats, active events), `/settlements`, `/relationships` (visible to all; editing admin-gated), `/government` (role assignment — visible to admin **or** that nation's alive nation_manager, who can grant only settlement_manager), `/reports` (reports + turn log). Nameset, hidden toggle, delete (all admin-only today) → a `/settings` child (danger zone at bottom). Hidden-nation redirect for non-admins stays.                                                                                                                            |
| `/worlds/$worldId/nations/$nationId/settlements/$settlementId` (`?section=`, 7 sections) | Everything behind tabs; economy section overloaded                                     | Promote to child routes: `/` (overview: turn outcome, readiness, active events, details, coordinates), `/citizens` (CitizensPanel + assignment board — drop vestigial `?assignmentTab=`), `/populations` (managed populations, currently inside population section), and economy exploded into `/buildings`, `/construction`, `/stockpiles`, `/deposits`, `/trade`, plus `/forecast`, `/reports`, `/history`. Admin section is only nameset + delete → becomes `/settings` (admin-gated). These are exactly the sidebar SETTLEMENT items.                                                                                            |
| `/worlds/$worldId/citizens/$citizenId`                                                   | Long vertical edit stack; non-admins redirected away from any citizen but their own PC | **Open read-only profiles to players (decided)**: any citizen in scope viewable — public info (name, age, sex, home settlement, job/assignment, family). Requires loosening `CitizenManagerRedirect` + an RLS/policy review (schema-change checklist applies). Layout: **two-column master layout** (mockup `2caf0110`): left = identity card (avatar, name, age, role, PC badge, partnerships); right = tabs: Overview (assignment), Family (parents, partnerships), Admin-only tabs (memories, lifecycle, NPC flavor/notes, core edit) rendered per `effectiveCanAdmin`. Add prev/next navigation within the citizen's settlement. |
| _(new)_ `/worlds/$worldId/citizens`                                                      | No citizens list exists anywhere                                                       | **World citizen directory (decided)**: filterable table across settlements (name, age, settlement, nation, job, PC/NPC, status). Settlement-scoped equivalent is the settlement `/citizens` route above. ⌘K palette searches the same data.                                                                                                                                                                                                                                                                                                                                                                                          |
| `/worlds/$worldId/events`                                                                | Fine                                                                                   | Keep routes; list gets type icons + status colors, filter bar, and a side detail panel on wide screens instead of full navigation for quick viewing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `/worlds/$worldId/history`                                                               | Name says little; only route with inline markup                                        | Rename nav label to **Turn Log**; extract inline markup into `features/turns` page component like every other route.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `/worlds/$worldId/configuration` (`?tab=`, 10 tabs)                                      | 10-way tab strip                                                                       | Keep `?tab=` URLs (zod-validated, `?blueprint=` deep-links into buildings) but drive them from the sidebar `SidebarMenuSub`. In-page tab strip removed. Route already requires `canAdmin` (redirects otherwise) — sidebar sub-menu gets the same gate; world-settings item superadmin-only, as today. Optionally promote to child routes later — mechanical, low priority.                                                                                                                                                                                                                                                           |
| `/notifications`                                                                         | Detached page                                                                          | Keep; sidebar item + badge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `/superadmin`, `/superadmin/templates`                                                   | Header link only for discoverability                                                   | ADMIN sidebar group (super-admin gated).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### 4.2 Migration notes

- TanStack Router: sections → child routes = new `worlds.$worldId....settlements.$settlementId.<section>.tsx`
  files, each thin, composing the existing panel component. Old `?section=` URLs get a
  redirect in the parent route's `beforeLoad` for bookmark compatibility.
- `WorldEntryGate` stays the gate for `/worlds/$worldId/*` but stops rendering
  `WorldContextBar`/`WorldNav`; it feeds world/PC context to the sidebar via the
  existing `ActivePlayerCharacterProvider` plus a small new
  `WorldScopeProvider` (current/last nation + settlement).
- `PlayerCharacterChooser` (first-entry character pick) stays a full-page interstitial —
  it's a good pattern — but restyled to the new density.

### 4.3 Density rules (applies to every page)

- No page-level `max-w-4xl/5xl` wrappers; content fills `SidebarInset` with `p-4 lg:p-6`.
  Wide-content surfaces (tables, boards) get horizontal room they currently lack.
- **Stat-tile row** at top of every overview page (world/nation/settlement dashboards):
  compact `Card` with icon, value, one-line context — mockup pattern, 4–6 tiles,
  `grid-cols-2 md:grid-cols-3 xl:grid-cols-5`.
- **Tables first** for collections (citizens, buildings, stockpiles, trade routes,
  events, worlds): shadcn `table.tsx` with icon + name cell, status `Badge`, inline
  progress bars, row actions via `dropdown-menu`. Card grids only where imagery/summary
  matters (world list, blueprint gallery).
- **Master-detail on wide screens**: list left (2/3) + selected-item panel right (1/3)
  — the mockups use this on stockpiles/deposits/trade and it fits citizens, events,
  and buildings well. Panel is a `Card`, not a route change; falls back to `Sheet` on
  narrow screens.
- Card padding standardizes at `p-4`; section gaps `gap-4`; page sections use
  headings + `Separator` instead of one bordered card per paragraph.
- `ConfigPanelShell`'s `min-h-[200px]` removed; skeletons (`SidebarMenuSkeleton`,
  existing `SkeletonLoaders`) own the loading heights.

## 5. Visual refresh (color, icons, imagery)

Current theme is zero-chroma grayscale; the mockups get their life from a dark navy
sidebar, one strong primary blue, and consistent semantic + categorical color.

1. **Brand hue.** Introduce a primary with actual chroma — deep blue/indigo family per
   mockups (e.g. `oklch(0.55 0.18 262)` ballpark; tune against AA contrast). Token-only
   change in `src/index.css` (`--primary`, `--ring`, `--chart-1`, sidebar accent).
2. **Dark sidebar in light mode** (mockup signature): set the light-mode `--sidebar*`
   tokens to the dark navy palette so the sidebar is dark while content stays light;
   dark mode uses a near-black sidebar. Pure token work, sidebar component untouched.
3. **Semantic status colors** — `success`/`warning` tokens already exist; add them to
   badges consistently: healthy/at-risk/critical stockpiles, on-track/delayed
   construction, turn-ready states, event severity.
4. **Categorical color for entities** (see `dataviz` guidance when building charts):
   resource categories (food/materials/goods/fuel), building types, event types. Small
   fixed palette, used in table icon chips, badges, and charts alike.
5. **Icons everywhere nav or type appears.** Lucide set, one icon per sidebar item and
   per domain (citizens, buildings, construction, stockpiles, deposits, populations,
   trade, events, reports, turn log, config areas). Icon chips (rounded square,
   tinted background) in table rows and stat tiles — this is most of the mockups'
   perceived polish.
6. **Avatars.** Citizens get initial-based `avatar.tsx` fallbacks with deterministic
   background color from the categorical palette (seeded by citizen id; no RNG at
   render). Real portraits are out of scope.
7. **Imagery (later/optional).** Mockups use illustrated building/resource art. Park
   this behind a phase-6 asset decision (commission vs. generate vs. skip); layout
   should not depend on it.

## 6. Implementation plan

Each phase ships independently; app stays working between phases.

**Phase 1 — Shell swap (the big one, mostly mechanical)**

- `npx shadcn@latest add sidebar` (+ sidebar-07 block as reference).
- New `src/components/app/AppSidebar.tsx` (+ small pieces: `WorldSwitcher`,
  `CharacterCard`, `NavGroup` files under `components/app/sidebar/`).
- Rewrite `AppLayout` to `SidebarProvider`/`SidebarInset`; slim `AppHeader` (trigger,
  breadcrumb, turn chip, End Turn, bell); delete `AppFooter`, `WorldContextBar`,
  `WorldNav`; relocate `ActiveCharacterSwitcher` into sidebar.
- Sidebar links target _existing_ routes/`?section=`/`?tab=` URLs — no route changes yet.
- Remove page-level `max-w-*` wrappers (small diff per page).

**Phase 2 — Switchers + palette**

- World switcher dropdown (worlds query already exists for `/worlds`).
- Settlement/nation group-label switchers + `WorldScopeProvider` (last-visited scope).
- ⌘K command palette with entity search + core actions.

**Phase 3 — Route reorganization**

- Settlement `?section=` → child routes (with redirects); economy exploded into
  buildings/construction/stockpiles/deposits/trade; populations gets its own route;
  vestigial `?assignmentTab=` deleted.
- Nation detail split into child routes.
- Citizen detail two-column + tabs; **citizen read-only visibility change** (loosen
  `CitizenManagerRedirect`; RLS/policy review + migration/typegen decision per the
  schema-change checklist — citizens SELECT policy must allow world members, and any
  admin-only fields like memories/NPC notes must stay protected at the query level).
- New citizen directory routes: `/worlds/$worldId/citizens` (world) and settlement
  `/citizens`. Home redirect for signed-in users.

**Phase 4 — Density + dashboards**

- Stat-tile component (shared); world/nation/settlement overviews become dashboards.
- Tables-first pass on collections; master-detail panels for stockpiles/deposits/
  trade/events/citizens.

**Phase 5 — Theme + iconography**

- Brand hue + dark sidebar tokens; status badge audit; icon chip component; nav and
  domain icon assignment; citizen avatar fallbacks.

**Phase 6 (optional) — Imagery**

- Decide on illustration assets; add to world cards, blueprint gallery, deposit/
  population detail panels.

## 7. Risks / open questions

1. **Scope stickiness rules (decided).** Settlement pin order: last-viewed
   settlement (localStorage) → active PC's home settlement → none (group collapses to
   "Choose a settlement…"; optionally first settlement in scope if "none" proves
   annoying). No server-side visit tracking (decided) — stickiness doesn't follow the
   user across devices; acceptable.
2. **Citizen visibility is a security-sensitive change (decided direction, needs
   care).** Opening read-only citizen profiles to players touches RLS policies on
   citizens (and possibly memories/partnerships). The UI redirect is not the security
   boundary — verify what the citizens SELECT policy actually allows non-admins today
   before assuming the change is UI-only. Admin-only data (memories, lifecycle, NPC
   notes/flavor) must remain inaccessible via API, not just hidden in the UI.
3. **Settlement group length.** 11–12 items is long; if it feels heavy, collapse the
   economy items (`Buildings…Trade Routes`) into a collapsible "Economy" sub-menu —
   sidebar-05 pattern. Decide after Phase 1 dogfooding.
4. **Permission-driven rendering.** Sidebar must respect `useEffectiveCanAdmin`
   (active PC suppresses admin) — ADMIN group and Configuration sub-menu hide/show on
   character switch. Existing context already exposes this; just wire it. Government
   item additionally shows for the nation's alive nation_manager.
5. **Tests.** `AppHeader.test.tsx`, `WorldBreadcrumb.test.tsx`, `worlds.test.tsx`,
   `__root.test.tsx` assert current chrome; Phase 1 includes rewriting them around the
   sidebar shell.
6. **Mobile.** Sheet-based sidebar covers nav, but dense tables need per-page overflow
   strategy (`overflow-x-auto` wrappers) — include in Phase 4 acceptance.
7. **End Turn placement (decided).** Turn chip visible to everyone; End Turn button
   rendered only for users who can end the turn — non-admins never see it (no
   disabled placeholder).
