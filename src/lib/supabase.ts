import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const hasSupabaseConfig =
  url !== undefined && url !== "" && anonKey !== undefined && anonKey !== "";

export const supabase = hasSupabaseConfig ? createClient(url, anonKey) : null;
