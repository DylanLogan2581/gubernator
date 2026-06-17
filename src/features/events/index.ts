// Events feature — create, list, and manage world events.
// UI components and RPC mutations for atomic multi-target event creation.

export { ActiveEventsCard } from "./components/ActiveEventsCard";
export { EventsPage } from "./components/EventsPage";
export { EventsList } from "./components/EventsList";
export { EventCreateWizard } from "./components/EventCreateWizard";
export { EventCreateNewPage } from "./components/EventCreateNewPage";
export { EventEditPage } from "./components/EventEditPage";
export { EventDetail } from "./components/EventDetail";

export {
  EventMutationError,
  cancelEventGroupMutationOptions,
  cancelEventMutationOptions,
  createEventGroupMutationOptions,
  editEventGroupMutationOptions,
  isEventMutationError,
} from "./mutations/eventMutations";

export {
  activeNationEventsQueryOptions,
  activeSettlementEventsQueryOptions,
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
  editEventGroupInputSchema,
} from "./schemas/eventSchemas";
export type {
  CancelEventGroupInput,
  CancelEventInput,
  CreateEventGroupInput,
  EditEventGroupInput,
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
