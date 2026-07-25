import { Castle } from "lucide-react";

import { LoreImageAvatar } from "@/components/shared/LoreImageAvatar";

import { useSettlementImageSignedUrl } from "../queries/settlementImageQueries";

import type { JSX } from "react";

type SettlementFlagAvatarProps = {
  readonly className?: string;
  readonly flagPath: string | null;
  readonly interactive?: boolean;
  readonly settlementId: string;
  readonly settlementName?: string;
};

// Shown beside a settlement's name across settlement surfaces (#1373), modeled
// on NationFlagAvatar. Falls back to a castle glyph whenever there's no flag
// yet or its signed URL hasn't resolved. Non-interactive usages (e.g. inside a
// list-row Link) stay a plain decorative image.
export function SettlementFlagAvatar({
  className,
  flagPath,
  interactive = false,
  settlementId,
  settlementName,
}: SettlementFlagAvatarProps): JSX.Element {
  const { url } = useSettlementImageSignedUrl(flagPath);

  return (
    <LoreImageAvatar
      aspectClassName="aspect-[3/2]"
      className={className}
      interactive={interactive}
      label={`${settlementName ?? "Settlement"} flag`}
      paletteSeed={settlementId}
      placeholder={Castle}
      url={url}
    />
  );
}
