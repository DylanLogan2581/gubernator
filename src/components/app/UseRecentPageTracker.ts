import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";

import { matchEntityPath, recordRecentPage } from "@/lib/recentPages";

// Records the current page into the command palette's Recents ring (#1011)
// whenever the viewer lands on a world/nation/settlement/citizen detail
// page. Mounted once in AppLayout so it fires on every route change. Routes
// don't carry a title of their own, so the page's <h1> (always PageHeader's
// title) is read as the label instead of threading one through every page.
export function useRecentPageTracker(): void {
  const location = useLocation();

  useEffect(() => {
    const matched = matchEntityPath(location.pathname);
    if (matched === null) {
      return;
    }

    const label = document.querySelector("h1")?.textContent?.trim();
    if (label === undefined || label.length === 0) {
      return;
    }

    recordRecentPage({ ...matched, label });
  }, [location.pathname]);
}
