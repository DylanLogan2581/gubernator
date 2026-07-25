import { Stamp } from "lucide-react";

import { LoreImageAvatar } from "@/components/shared/LoreImageAvatar";

import { useSettlementImageSignedUrl } from "../queries/settlementImageQueries";

import type { JSX } from "react";

type SettlementSealAvatarProps = {
  readonly className?: string;
  readonly interactive?: boolean;
  readonly sealPath: string | null;
  readonly settlementId: string;
  readonly settlementName?: string;
};

// Square emblem shown on the settlement overview (#1373). Falls back to a stamp
// glyph whenever there's no seal yet or its signed URL hasn't resolved.
export function SettlementSealAvatar({
  className,
  interactive = false,
  sealPath,
  settlementId,
  settlementName,
}: SettlementSealAvatarProps): JSX.Element {
  const { url } = useSettlementImageSignedUrl(sealPath);

  return (
    <LoreImageAvatar
      aspectClassName="aspect-square"
      className={className}
      interactive={interactive}
      label={`${settlementName ?? "Settlement"} seal`}
      paletteSeed={settlementId}
      placeholder={Stamp}
      url={url}
    />
  );
}
