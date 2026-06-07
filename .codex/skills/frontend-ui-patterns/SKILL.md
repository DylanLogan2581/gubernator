---
name: frontend-ui-patterns
description: "Use for Gubernator React UI work: Tailwind, shadcn/Radix primitives, TanStack Form/Query UI states, Sonner toasts, accessibility, repeated markup, forms, dialogs, tables, and component organization."
---

# Frontend UI Patterns

## Stack

- React 19 + TanStack Router + TanStack Query + TanStack Form.
- Tailwind v4 via `@tailwindcss/vite`.
- shadcn/Radix primitives in `src/components/ui`.
- Icons: `lucide-react`.
- Toasts: Sonner via `src/lib/notify.ts`.

## Layout

- Work app, not landing page. Dense, scannable, calm.
- Use cards only for repeated items, dialogs, framed tools. No card-in-card.
- Page sections = full-width/unframed layout with constrained content.
- Use existing `AppLayout`, shared states, panels, and feature frames.
- Keep card radius `rounded-md` or smaller unless primitive dictates.
- Text must fit mobile/desktop; no overlap; no viewport-scaled font sizes.
- Use `tracking-normal`; avoid negative letter spacing.
- Avoid one-hue palette drift. Use tokens from `src/index.css`.

## Controls

- Buttons for commands. Icon buttons need tooltip/label.
- Use lucide icons where available.
- Tabs for view switching.
- Dialog for destructive/complex confirmations.
- Native select/segmented controls for enum choices.
- Checkbox/switch style controls for boolean values.
- Inputs/sliders/steppers for numeric values.
- Keep loading/error/empty states explicit with shared components.

## Forms

- Put large forms in feature components, not routes.
- Zod schema lives in feature `schemas`.
- Parse/validate before mutation; map known error codes to user text.
- Field errors render under field.
- Success/failure feedback via `notifyMutationSuccess` / `notifyMutationError`.
- No success/failure banners in document flow.
- Destructive action: confirmation dialog + precise object name.

## Accessibility

- Semantic headings/sections/lists/tables.
- Inputs have labels or accessible names.
- Icon-only controls have `aria-label`.
- Decorative icons use `aria-hidden="true"`.
- Dialogs focus correctly via primitives.
- Keyboard path works for tabs, menus, dialogs, forms.
- Visible focus state remains.

## Data UI

- Components call query/mutation option builders, not Supabase directly.
- Use pending/error/empty states before rendering data views.
- Preserve archived/read-only world states; disable or hide mutations.
- Respect `canAdmin`, `canManage`, active PC, and world access context.
- Prefer focused child components once JSX branches grow.
