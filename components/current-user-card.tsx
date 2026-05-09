"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Me = {
  name: string;
  roleLabel: string;
  email: string | null;
};

export function CurrentUserCard() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let alive = true;
    async function loadMe() {
      const supabase = createSupabaseBrowserClient();
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      const response = await fetch("/api/me", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!response.ok) return;
      const payload = await response.json();
      if (alive) setMe(payload.user);
    }
    void loadMe();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="rounded-md bg-field p-3">
      <div className="text-sm font-bold text-ink">{me?.name ?? "未登录"}</div>
      <div className="mt-1 text-xs text-ink/60">{me?.roleLabel ?? "请登录"}</div>
      {me?.email ? <div className="mt-1 truncate text-xs text-ink/45">{me.email}</div> : null}
    </div>
  );
}
