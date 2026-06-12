// Events feature — create, list, and manage world events.
// UI components and RPC mutations for atomic multi-target event creation.

export { EventsPage } from "./components/EventsPage";
export { EventsList } from "./components/EventsList";
export { EventCreateWizard } from "./components/EventCreateWizard";
export { EventDetail } from "./components/EventDetail";

export {
  EventMutationError,
  cancelEventGroupMutationOptions,
  cancelEventMutationOptions,
  createEventGroupMutationOptions,
  isEventMutationError,
} from "./mutations/eventMutations";

export {
  eventDetailQueryOptions,
  eventsListQueryOptions,
  isEventsError,
} from "./queries/eventQueries";
export type { EventsError } from "./queries/eventQueries";
export { eventQueryKeys } from "./queries/eventQueryKeys";

export {
  cancelEventGroupInputSchema,
  cancelEventInputSchema,
  createEventGroupInputSchema,
} from "./schemas/eventSchemas";
export type {
  CancelEventGroupInput,
  CancelEventInput,
  CreateEventGroupInput,
} from "./schemas/eventSchemas";

export type {
  Event,
  EventDurationType,
  EventGroup,
  EventListFilters,
  EventScopeType,
  EventStatus,
  EventWithGroup,
} from "./types/eventTypes";
