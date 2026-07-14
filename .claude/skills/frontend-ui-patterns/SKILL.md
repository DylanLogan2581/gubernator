---
name: frontend-ui-patterns
description: >-
  React/Tailwind/shadcn/Sonner conventions in this repo: forms, data fetching,
  loading/error/empty states, toasts, design tokens, accessibility. Trigger
  for any component, page, form, or styling work under src/.
---

# Frontend UI Patterns

Stack: React 19 + Tailwind v4 (no JS config — tokens in `src/index.css`) + shadcn/ui (`radix-nova` style) + TanStack Query v5 + Sonner. Router-level structure lives in project-structure-placement skill.

## Non-negotiables

- **No form library.** `react-hook-form` and `@tanstack/react-form` are installed but UNUSED — do not reach for them. Pattern: per-field `useState` + zod `safeParse` on submit + `useFieldErrors` from `@/lib/zodFieldErrors`. Parent owns the mutation; form calls `onSubmit(input)`.
- **No Suspense / `useSuspenseQuery`.** Manual states with shared components: `isLoading` → `<LoadingState/>` (or `TableSkeleton`/`CardListSkeleton`), `isError` → `<ErrorState/>`, empty array → `<EmptyState/>`.
- **Toasts via `@/lib/notify`**: `notifyMutationSuccess(message)` / `notifyMutationError(error, fallback)` — always pass a fallback. Toast calls live in the component's `.mutate(input, {onSuccess, onError})` handlers; cache invalidation lives in the mutation-option factory's `onSuccess`. Don't put toasts in factories.
- Radix comes from the aggregate `radix-ui` package (`import { Slot } from "radix-ui"`), never `@radix-ui/react-*`.
- New colors = oklch CSS vars in `src/index.css`, no hardcoded hex. Dark mode via custom `@custom-variant` (`.dark` class AND media query).

## Reuse Before Building

| Need                                             | Use                                                                                       |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Page title row                                   | `shared/PageHeader` (icon, title, description, actions slot)                              |
| Loading / error / empty / denied                 | `shared/LoadingState`, `ErrorState`, `EmptyState`, `AccessDeniedState`, `SkeletonLoaders` |
| Confirm destructive action                       | `shared/ConfirmDialog` (isPending spinner built in)                                       |
| List + detail screen                             | `shared/MasterDetailLayout` (detail → Sheet on mobile via `useIsMobile`)                  |
| CRUD config lists                                | `shared/ConfigCrudPanel` + `shared/DataTable` (react-table + virtualization)              |
| Dashboard number                                 | `shared/StatTile` (tones, built-in loading skeleton)                                      |
| Sonner mount, Toaster, CommandPalette, skip-link | already in `__root.tsx` / `AppLayout` — mount nothing twice                               |

Primitives: 44 files in `src/components/ui` (cva variants, `data-slot` attrs; button variants default/outline/secondary/ghost/destructive/link). Extend via variants, don't fork.

## Data Fetching

- Query factories `queryOptions()` in `features/<f>/queries/`, keys in `*QueryKeys.ts`; explicit select-column strings; rows mapped snake_case→camelCase via `toXxx(row)` helpers; errors thrown through `normalizeSupabaseError`.
- Mutations: `mutationOptions({mutationFn, mutationKey, onSuccess})`; component passes `queryClient` into the factory for invalidation. Input re-parsed with zod in `mutationFn` (yes, validation is intentionally duplicated client + mutation).
- Typed mutation errors via `createMutationError` (`@/lib/mutationError`) carrying `code` + `issues[]`.

## Conventions

- `cn()` = `twMerge(clsx())` from `@/lib/utils` for conditional classes. No tailwind class sorter — keep rough box-model order.
- Explicit return types (`: JSX.Element`), `readonly` props, named exports.
- Max lengths from `@/lib/inputLimits`; slugs via `toSlug` from `@/lib/slugify` + `SlugHint`.
- A11y: icons `aria-hidden="true"`; status components carry `role="status"`/`role="alert"`; `useId()` for `aria-labelledby`/`describedby`; keep the `p-4 lg:p-6` main padding; test mobile (`sm:`/`lg:` breakpoints).

## Traps

- Two toast entry points exist (raw `sonner` in delete hooks) — prefer `@/lib/notify` for new code.
- Every UI change requires browser verification with dev-browser per CLAUDE.md — screenshot, interact, console, mobile width — before claiming done.
