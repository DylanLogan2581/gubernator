import { Printer } from "lucide-react";
import { type JSX } from "react";

import { Button } from "@/components/ui/button";

import { CharterBodiesSection } from "./CharterBodiesSection";
import { CharterDecreesSection } from "./CharterDecreesSection";
import { CharterHeader } from "./CharterHeader";
import { CharterLawsSection } from "./CharterLawsSection";
import { CharterOfficeDirectory } from "./CharterOfficeDirectory";
import { CharterRulerCard } from "./CharterRulerCard";
import { CharterSettlementsSection } from "./CharterSettlementsSection";

import type { Nation } from "../../types/nationTypes";

// #1122: the nation charter — a public, read-only, print-friendly page
// presenting a nation's entire government for roleplay reference. Pure
// composition over existing government/office/document/decree data; every
// section here reads the same query options its manage-capable government
// tab counterpart uses, just rendered without edit chrome.
export function NationCharterPage({
  nation,
  worldId,
}: {
  readonly nation: Nation;
  readonly worldId: string;
}): JSX.Element {
  return (
    <div id="nation-charter" className="grid gap-6">
      <div className="flex justify-end print:hidden">
        <Button
          onClick={() => {
            window.print();
          }}
          size="sm"
          variant="outline"
        >
          <Printer aria-hidden="true" />
          Print charter
        </Button>
      </div>

      <CharterHeader nation={nation} />
      <CharterRulerCard nation={nation} />
      <CharterBodiesSection nationId={nation.id} />
      <CharterOfficeDirectory nationId={nation.id} worldId={worldId} />
      <CharterLawsSection nationId={nation.id} />
      <CharterDecreesSection nationId={nation.id} worldId={worldId} />
      <CharterSettlementsSection nationId={nation.id} worldId={worldId} />
    </div>
  );
}
