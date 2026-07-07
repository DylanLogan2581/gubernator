import { UserCircle2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  categoricalForegroundClassName,
  hashToCategoricalSlot,
} from "@/lib/categoricalPalette";
import { cn } from "@/lib/utils";

import type { JSX } from "react";

type CitizenAvatarProps = {
  readonly id: string;
  readonly name: string;
  readonly profilePhotoUrl?: string | null;
  readonly size?: "default" | "sm" | "lg";
  readonly className?: string;
};

/**
 * Citizen avatar: profile photo if set, else initials on a background color
 * deterministically seeded by citizen id (docs/ui-redesign.md §5.6) — same
 * citizen always gets the same color, no render-time randomness. Falls back
 * to a generic person icon when the name has no usable initial.
 */
export function CitizenAvatar({
  id,
  name,
  profilePhotoUrl,
  size,
  className,
}: CitizenAvatarProps): JSX.Element {
  const initial = name.trim().charAt(0).toUpperCase();
  const foregroundClassName = categoricalForegroundClassName(
    hashToCategoricalSlot(id),
  );

  return (
    <Avatar className={className} size={size}>
      {profilePhotoUrl !== null &&
      profilePhotoUrl !== undefined &&
      profilePhotoUrl !== "" ? (
        <AvatarImage alt="" src={profilePhotoUrl} />
      ) : null}
      <AvatarFallback className={cn("bg-muted", foregroundClassName)}>
        {initial === "" ? (
          <UserCircle2 aria-hidden="true" className="size-[55%]" />
        ) : (
          initial
        )}
      </AvatarFallback>
    </Avatar>
  );
}
