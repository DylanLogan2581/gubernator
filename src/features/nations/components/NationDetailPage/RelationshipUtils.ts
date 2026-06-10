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
