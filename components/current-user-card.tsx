"use client";

import { useEffect, useState } from "react";
import { getAuthHeaderResult } from "@/lib/client-auth";
import { safeJson } from "@/lib/client-safe-json";

type Me = {
  name: string;
  roleLabel: string;
  email: string | null;
};

export function CurrentUserCard() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function loadMe() {
      try {
        const auth = await getAuthHeaderResult();
        if (auth.error) {
          if (alive) setError(auth.error);
          return;
        }
        const response = await fetch("/api/me", { headers: auth.headers });
        const payload = await safeJson(response) as { user?: Me; error?: string } | null;
        if (!response.ok) {
          if (alive) setError(payload?.error ?? auth.error ?? "无法读取当前用户。");
          return;
        }
        if (alive) {
          setMe(payload?.user ?? null);
          setError("");
        }
      } catch {
        if (alive) setError("无法连接认证服务，请检查网络或 Supabase 配置");
      }
    }
    void loadMe();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="rounded-md bg-field p-3">
      <div className="text-sm font-bold text-ink">{me?.name ?? "未登录"}</div>
      <div className="mt-1 text-xs text-ink/60">{error || me?.roleLabel || "请登录"}</div>
      {me?.email ? <div className="mt-1 truncate text-xs text-ink/45">{me.email}</div> : null}
    </div>
  );
}
