"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Database, RefreshCw, Server, ShieldCheck, UserCircle } from "lucide-react";
import { getAuthHeaderResult } from "@/lib/client-auth";
import { responseError, safeJson } from "@/lib/client-safe-json";

type HealthStatus = "normal" | "slow" | "down";

type HealthPayload = {
  ok?: boolean;
  status?: HealthStatus;
  message?: string;
  version?: string;
  checkedAt?: string;
  api?: {
    ok: boolean;
    status: HealthStatus;
    responseTimeMs: number;
  };
  supabase?: {
    ok: boolean;
    status: HealthStatus;
    message: string;
    configured: {
      ok: boolean;
      supabaseUrlConfigured: boolean;
      anonKeyConfigured: boolean;
      serviceRoleConfigured: boolean;
    };
  };
  database?: {
    ok: boolean;
    status: HealthStatus;
    responseTimeMs: number;
    error: string;
  };
  auth?: {
    ok: boolean;
    userName: string;
    role: string;
    roleLabel: string;
    error: string;
  };
  error?: string;
};

const statusText: Record<HealthStatus, string> = {
  normal: "正常",
  slow: "连接慢",
  down: "不可用"
};

const tone: Record<HealthStatus, string> = {
  normal: "border-emerald-200 bg-emerald-50 text-emerald-800",
  slow: "border-amber-200 bg-amber-50 text-amber-800",
  down: "border-red-200 bg-red-50 text-red-800"
};

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function StatusPill({ status }: { status: HealthStatus }) {
  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${tone[status]}`}>{statusText[status]}</span>;
}

function CheckCard({
  title,
  icon: Icon,
  status,
  children
}: {
  title: string;
  icon: typeof Activity;
  status: HealthStatus;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-brand">
            <Icon size={22} />
          </div>
          <h2 className="font-black text-ink">{title}</h2>
        </div>
        <StatusPill status={status} />
      </div>
      <div className="mt-4 text-sm text-ink/68">{children}</div>
    </section>
  );
}

export function HealthClient() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const auth = await getAuthHeaderResult();
      const response = await fetch("/api/health", { headers: auth.headers, cache: "no-store" });
      const payload = await safeJson(response) as HealthPayload | null;
      if (!response.ok || !payload) {
        setError(responseError(payload ?? { error: auth.error ?? "" }, "健康检查失败。"));
        setHealth(null);
      } else {
        setHealth(payload);
      }
    } catch {
      setError("数据库服务暂不可用，请检查 Supabase 项目是否暂停");
      setHealth(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const status = health?.status ?? "down";
  const supabaseStatus = health?.supabase?.status ?? status;
  const databaseStatus = health?.database?.status ?? status;
  const apiStatus = health?.api?.status ?? status;
  const authStatus: HealthStatus = health?.auth?.ok ? "normal" : "slow";

  return (
    <div className="space-y-5">
      <section className={`rounded-lg border p-4 shadow-sm ${tone[status]}`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            {status === "down" ? <AlertTriangle className="mt-0.5 shrink-0" size={24} /> : <CheckCircle2 className="mt-0.5 shrink-0" size={24} />}
            <div>
              <h2 className="text-xl font-black">{health?.message || error || "正在检查系统状态"}</h2>
              <p className="mt-1 text-sm font-semibold opacity-80">
                {status === "down" ? "如果数据突然为空，优先检查 Supabase 项目是否暂停或数据库连接是否恢复。" : "系统状态检查用于区分服务故障和真实业务数据。"}
              </p>
            </div>
          </div>
          <button type="button" className="btn-secondary bg-white/90" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            重新检查
          </button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <CheckCard title="Supabase 连接状态" icon={Server} status={supabaseStatus}>
          <div className="space-y-2">
            <p>{health?.supabase?.message || "数据库服务暂不可用，请检查 Supabase 项目是否暂停"}</p>
            <p>URL：{health?.supabase?.configured.supabaseUrlConfigured ? "已读取" : "未读取"}</p>
            <p>Anon Key：{health?.supabase?.configured.anonKeyConfigured ? "已读取" : "未读取"}</p>
            <p>Service Role：{health?.supabase?.configured.serviceRoleConfigured ? "已读取" : "未读取"}</p>
          </div>
        </CheckCard>

        <CheckCard title="数据库连接状态" icon={Database} status={databaseStatus}>
          <div className="space-y-2">
            <p>{health?.database?.ok ? "数据库查询正常。" : "数据库服务暂不可用，请检查 Supabase 项目是否暂停"}</p>
            <p>响应时间：{health?.database?.responseTimeMs ?? "-"} ms</p>
            {health?.database?.error ? <p className="font-semibold text-red-700">错误：{health.database.error}</p> : null}
          </div>
        </CheckCard>

        <CheckCard title="当前登录用户" icon={UserCircle} status={authStatus}>
          <div className="space-y-2">
            <p>用户：{health?.auth?.userName || "未识别"}</p>
            <p>角色：{health?.auth?.roleLabel || health?.auth?.role || "未识别"}</p>
            {health?.auth?.error ? <p className="font-semibold text-amber-700">提示：{health.auth.error}</p> : null}
          </div>
        </CheckCard>

        <CheckCard title="API 与版本" icon={ShieldCheck} status={apiStatus}>
          <div className="space-y-2">
            <p>API：{health?.api?.ok ? "正常" : "异常"}</p>
            <p>API 响应时间：{health?.api?.responseTimeMs ?? "-"} ms</p>
            <p>当前版本：{health?.version || "-"}</p>
            <p>检查时间：{formatDateTime(health?.checkedAt)}</p>
          </div>
        </CheckCard>
      </div>
    </div>
  );
}
