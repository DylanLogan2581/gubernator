import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

import type { QueryClient } from "@tanstack/react-query";

function getSessionEmailFallback(): string {
  if (supabase === null) {
    return "Supabase is not configured.";
  }

  return "No active session.";
}

export const sessionQueryOptions = queryOptions({
  queryKey: ["home", "supabase-session"],
  queryFn: async (): Promise<string> => {
    if (supabase === null) {
      return getSessionEmailFallback();
    }

    const { data } = await supabase.auth.getSession();
    const email = data.session?.user.email;

    if (email === undefined) {
      return getSessionEmailFallback();
    }

    return email;
  },
});

export async function preloadHomePage(queryClient: QueryClient): Promise<void> {
  await queryClient.ensureQueryData(sessionQueryOptions);
}
