import {
  AlertTriangle,
  ArrowLeftRight,
  Baby,
  Bell,
  Building2,
  Coins,
  FileX2,
  Gavel,
  Gem,
  HardHat,
  Heart,
  HeartCrack,
  PawPrint,
  RefreshCw,
  Skull,
  Swords,
  UserMinus,
  Zap,
} from "lucide-react";

import { type Constants } from "@/types/database";

import type { LucideIcon } from "lucide-react";

type NotificationType =
  (typeof Constants.public.Enums.notification_type)[number];

const NOTIFICATION_TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  "turn.completed": RefreshCw,
  trade_proposal_received: ArrowLeftRight,
  trade_proposal_accepted: ArrowLeftRight,
  trade_proposal_rejected: ArrowLeftRight,
  trade_route_cancelled: ArrowLeftRight,
  "trade_route.paused": ArrowLeftRight,
  "trade_route.resumed": ArrowLeftRight,
  "building.auto_deconstructed": Building2,
  "building.suspended": Building2,
  "building.recovered": Building2,
  "citizen.born": Baby,
  "citizen.died": Skull,
  "construction.completed": HardHat,
  "construction.paused": HardHat,
  "deposit.depleted": Gem,
  "managed_population.declining": PawPrint,
  "managed_population.extinct": PawPrint,
  "nation.succession": Skull,
  "nation.grant_received": Coins,
  "nation.subsidy_received": Coins,
  "nation.treaty_broken": FileX2,
  "nation.treaty_expired": FileX2,
  "nation.tribute_missed": Coins,
  "currency.default": Coins,
  "currency.confidence_collapsing": AlertTriangle,
  "partnership.formed": Heart,
  "partnership.widowed": HeartCrack,
  "settlement.homelessness_occurred": AlertTriangle,
  "settlement.starvation_occurred": AlertTriangle,
  "event.activated": Zap,
  "event.expired": Zap,
  "military.upkeep_unpaid": Swords,
  "military.unit_disbanded": Swords,
  "army.relocated": Swords,
  "player.died": Skull,
  "player.widowed": HeartCrack,
  "law.amendment_passed": Gavel,
  "law.amendment_failed": Gavel,
  "law.amendment_withdrawn": Gavel,
  "law.amendment_expired": Gavel,
  "office.term_ended": UserMinus,
};

/** Falls back to a generic bell for any notification_type not in the map. */
export function getNotificationTypeIcon(notificationType: string): LucideIcon {
  return NOTIFICATION_TYPE_ICONS[notificationType as NotificationType] ?? Bell;
}
