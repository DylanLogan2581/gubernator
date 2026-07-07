import {
  AlertTriangle,
  Hand,
  Heart,
  MinusCircle,
  Shield,
  Swords,
  type LucideIcon,
} from "lucide-react";

export function formatRelationshipStance(stance: string): string {
  switch (stance) {
    case "neutral":
      return "Neutral";
    case "friendly":
      return "Friendly";
    case "hostile":
      return "Hostile";
    case "at_war":
      return "At war";
    case "allied":
      return "Allied";
    case "non_aggression_pact":
      return "Non-aggression pact";
    default:
      return stance;
  }
}

export function getStanceIconConfig(stance: string): {
  Icon: LucideIcon;
  colorClass: string;
  label: string;
} {
  switch (stance) {
    case "neutral":
      return {
        Icon: MinusCircle,
        colorClass: "text-yellow-500",
        label: "Neutral stance",
      };
    case "friendly":
      return {
        Icon: Heart,
        colorClass: "text-green-500",
        label: "Friendly stance",
      };
    case "hostile":
      return {
        Icon: AlertTriangle,
        colorClass: "text-red-500",
        label: "Hostile stance",
      };
    case "at_war":
      return {
        Icon: Swords,
        colorClass: "text-red-700",
        label: "At war",
      };
    case "allied":
      return {
        Icon: Hand,
        colorClass: "text-green-500",
        label: "Allied stance",
      };
    case "non_aggression_pact":
      return {
        Icon: Shield,
        colorClass: "text-yellow-500",
        label: "Non-aggression pact",
      };
    default:
      return {
        Icon: MinusCircle,
        colorClass: "text-muted-foreground",
        label: stance,
      };
  }
}

export function getStanceBadgeClassName(stance: string): string {
  switch (stance) {
    case "neutral":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300";
    case "friendly":
      return "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300";
    case "hostile":
      return "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300";
    case "at_war":
      return "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300";
    case "allied":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300";
    case "non_aggression_pact":
      return "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}
