---
name: frontend-ui-patterns
description: Use for React, Tailwind, shadcn/ui, Sonner, accessibility, repeated markup, forms, or frontend component organization.
---

# Frontend UI Patterns

## Rules

- Use Tailwind for most styling.
- Prefer existing shadcn/ui primitives before adding new base patterns.
- If markup repeats, extract a component.
- Preserve accessibility: semantic HTML, labels, keyboard support, and visible focus states.
- Prefer design tokens from `src/index.css` over one-off values.
- Use Sonner toasts for mutation success and failure via `notifyMutationSuccess` and `notifyMutationError` in `src/lib/notify.ts`.
- Do not render success or failure banners in document flow. They shift layout.
- Field-level validation errors rendered directly under input stay inline.

## Boundary

- Keep route files thin. Compose page modules.
- Keep big forms and reusable UI out of routes.
- Reuse existing app/shared/feature patterns before new abstractions.
