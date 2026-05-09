"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase";

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return {};

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
