// Single source of truth for the app-internal route to a domain entity's page.
// Both the turn log (EntityRef / useTurnLogEntityLookup) and notification links
// (getNotificationEntityLinks) surface entity ids as links; keeping the id →
// path mapping here stops the two from drifting apart.

export type EntityRouteTarget =
  | { readonly kind: "citizen"; readonly citizenId: string }
  | { readonly kind: "nation"; readonly nationId: string }
  | {
      readonly kind: "settlement";
      /** Null when the nation isn't known — the settlement page can't be
       *  addressed without it, so `entityRoute` returns null. */
      readonly nationId: string | null;
      readonly settlementId: string;
    }
  | { readonly kind: "event"; readonly eventId: string }
  | {
      readonly kind: "tradeRoute";
      readonly nationId: string;
      readonly settlementId: string;
    };

/**
 * Builds the app-internal path for an entity within a world, or null when the
 * target can't be addressed (e.g. a settlement whose nation isn't known).
 */
export function entityRoute(
  worldId: string,
  target: EntityRouteTarget,
): string | null {
  switch (target.kind) {
    case "citizen":
      return `/worlds/${worldId}/citizens/${target.citizenId}`;
    case "nation":
      return `/worlds/${worldId}/nations/${target.nationId}`;
    case "settlement":
      return target.nationId === null
        ? null
        : `/worlds/${worldId}/nations/${target.nationId}/settlements/${target.settlementId}`;
    case "event":
      return `/worlds/${worldId}/events/${target.eventId}`;
    case "tradeRoute":
      return `/worlds/${worldId}/nations/${target.nationId}/settlements/${target.settlementId}/trade`;
  }
}
