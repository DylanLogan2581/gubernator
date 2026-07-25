import { Stamp } from "lucide-react";

import { LoreImageAvatar } from "@/components/shared/LoreImageAvatar";

import { useNationImageSignedUrl } from "../queries/nationImageQueries";

import type { JSX } from "react";

type NationSealAvatarProps = {
  readonly className?: string;
  readonly interactive?: boolean;
  readonly nationId: string;
  readonly nationName?: string;
  readonly sealPath: string | null;
};

// Square emblem shown on the nation overview header beside the flag (#1373).
// Falls back to a stamp glyph whenever there's no seal yet or its signed URL
// hasn't resolved.
export function NationSealAvatar({
  className,
  interactive = false,
  nationId,
  nationName,
  sealPath,
}: NationSealAvatarProps): JSX.Element {
  const { url } = useNationImageSignedUrl(sealPath);

  return (
    <LoreImageAvatar
      aspectClassName="aspect-square"
      className={className}
      interactive={interactive}
      label={`${nationName ?? "Nation"} seal`}
      paletteSeed={nationId}
      placeholder={Stamp}
      url={url}
    />
  );
}
