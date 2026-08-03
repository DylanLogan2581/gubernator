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
        colorClass: "text-muted-foreground",
        label: "Neutral stance",
      };
    case "friendly":
      return {
        Icon: Heart,
        colorClass: "text-success-foreground",
        label: "Friendly stance",
      };
    case "hostile":
      return {
        Icon: AlertTriangle,
        colorClass: "text-warning-foreground",
        label: "Hostile stance",
      };
    case "at_war":
      return {
        Icon: Swords,
        colorClass: "text-destructive",
        label: "At war",
      };
    case "allied":
      return {
        Icon: Hand,
        colorClass: "text-success-foreground",
        label: "Allied stance",
      };
    case "non_aggression_pact":
      return {
        Icon: Shield,
        colorClass: "text-muted-foreground",
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
      return "bg-muted text-muted-foreground";
    case "friendly":
      return "bg-success text-success-foreground";
    case "hostile":
      return "bg-warning text-warning-foreground";
    case "at_war":
      return "bg-destructive/10 text-destructive";
    case "allied":
      return "bg-success text-success-foreground";
    case "non_aggression_pact":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}
