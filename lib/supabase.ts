import { createBrowserClient } from "@supabase/ssr";

export const AUTH_NETWORK_ERROR_MESSAGE = "无法连接认证服务，请检查网络或 Supabase 配置";

function isValidSupabaseUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "localhost";
  } catch {
    return false;
  }
}

export function isSupabaseConfigured() {
  return Boolean(
    isValidSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getSupabaseConfigStatus() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) return { ok: false, error: "NEXT_PUBLIC_SUPABASE_URL 未配置。" };
  if (!isValidSupabaseUrl(url)) return { ok: false, error: "NEXT_PUBLIC_SUPABASE_URL 格式不正确。" };
  if (!anonKey) return { ok: false, error: "NEXT_PUBLIC_SUPABASE_ANON_KEY 未配置。" };
  return { ok: true, error: "" };
}

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !isValidSupabaseUrl(url) || !anonKey) {
    return null;
  }

  try {
    return createBrowserClient(url, anonKey);
  } catch {
    return null;
  }
}
