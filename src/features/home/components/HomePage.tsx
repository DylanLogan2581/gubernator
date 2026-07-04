import { HomeDioramaSection } from "./HomeDioramaSection";
import { HomeFeatureSection } from "./HomeFeatureSection";
import { HomeFooterSection } from "./HomeFooterSection";
import { HomeHeroSection } from "./HomeHeroSection";
import { HomeTurnCycleSection } from "./HomeTurnCycleSection";

import type { JSX } from "react";

export function HomePage(): JSX.Element {
  return (
    <div className="flex flex-col gap-10">
      <HomeHeroSection />
      <HomeTurnCycleSection />
      <HomeDioramaSection />
      <HomeFeatureSection />
      <HomeFooterSection />
    </div>
  );
}
