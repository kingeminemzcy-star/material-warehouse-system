"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuthHeaderResult } from "@/lib/client-auth";
import { safeJson } from "@/lib/client-safe-json";

type HealthStatus = "normal" | "slow" | "down" | "checking";

type HealthPayload = {
  ok?: boolean;
  status?: HealthStatus;
  message?: string;
  responseTimeMs?: number;
};

const statusClass: Record<HealthStatus, string> = {
  normal: "bg-emerald-500 shadow-emerald-500/40",
  slow: "bg-amber-400 shadow-amber-400/40",
  down: "bg-red-500 shadow-red-500/40",
  checking: "bg-zinc-300 shadow-zinc-300/30"
};

const statusLabel: Record<HealthStatus, string> = {
  normal: "系统正常",
  slow: "连接慢",
  down: "数据库不可用",
  checking: "检查中"
};

export function SystemStatusDot() {
  const [status, setStatus] = useState<HealthStatus>("checking");
  const [message, setMessage] = useState("正在检查系统状态");

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const auth = await getAuthHeaderResult();
        const response = await fetch("/api/health", { headers: auth.headers, cache: "no-store" });
        const payload = await safeJson(response) as HealthPayload | null;
        const nextStatus = payload?.status ?? (response.ok ? "normal" : "down");
        if (alive) {
          setStatus(nextStatus);
          setMessage(payload?.message || statusLabel[nextStatus]);
        }
      } catch {
        if (alive) {
          setStatus("down");
          setMessage("数据库服务暂不可用，请检查 Supabase 项目是否暂停");
        }
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <Link
      href="/health"
      className="btn-secondary min-h-10 px-3"
      title={`${statusLabel[status]}：${message}`}
      aria-label={`系统状态：${statusLabel[status]}`}
    >
      <span className={`h-2.5 w-2.5 rounded-full shadow-[0_0_0_4px] ${statusClass[status]}`} />
      <span className="hidden text-sm font-bold sm:inline">{statusLabel[status]}</span>
    </Link>
  );
}
