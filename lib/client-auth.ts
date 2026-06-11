"use client";

import { AUTH_NETWORK_ERROR_MESSAGE, createSupabaseBrowserClient, getSupabaseConfigStatus } from "@/lib/supabase";

export type AuthHeaderResult = {
  headers: Record<string, string>;
  error: string | null;
};

export async function getAuthHeaderResult(): Promise<AuthHeaderResult> {
  const config = getSupabaseConfigStatus();
  if (!config.ok) return { headers: {}, error: config.error };

  const supabase = createSupabaseBrowserClient();
  if (!supabase) return { headers: {}, error: AUTH_NETWORK_ERROR_MESSAGE };

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return { headers: {}, error: error.message || AUTH_NETWORK_ERROR_MESSAGE };
    const token = data.session?.access_token;
    return { headers: token ? { Authorization: `Bearer ${token}` } : {}, error: null };
  } catch {
    return { headers: {}, error: AUTH_NETWORK_ERROR_MESSAGE };
  }
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  return (await getAuthHeaderResult()).headers;
}
