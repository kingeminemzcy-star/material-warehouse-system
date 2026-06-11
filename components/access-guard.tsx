"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getAuthHeaderResult } from "@/lib/client-auth";

type Permissions = Record<string, boolean>;

function keyFromPath(pathname: string) {
  const segment = pathname.split("/").filter(Boolean)[0] || "dashboard";
  const map: Record<string, string> = {
    "purchase-requests": "purchaseRequests",
    approvals: "approvals",
    "purchase-orders": "purchaseOrders",
    stocktaking: "inventory",
    accounts: "accounts",
    logs: "logs",
    projects: "projects",
    bom: "bom",
    "bom-archive": "bom",
    materials: "materials",
    inbound: "inbound",
    outbound: "outbound",
    inventory: "inventory",
    suppliers: "suppliers",
    units: "units",
    photos: "photos",
    health: "dashboard",
    changelog: "dashboard",
    dashboard: "dashboard"
  };
  return map[segment] ?? "dashboard";
}

export function AccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const auth = await getAuthHeaderResult();
        if (auth.error) {
          if (alive) {
            setPermissions({});
            setError(auth.error);
          }
          return;
        }
        const response = await fetch("/api/me", { headers: auth.headers, cache: "no-store" });
        const payload = await response.json().catch(() => null) as { user?: { permissions?: Permissions }; error?: string } | null;
        if (!response.ok) {
          if (alive) {
            setPermissions({});
            setError(payload?.error ?? auth.error ?? "无法读取当前账号权限。");
          }
          return;
        }
        if (alive) {
          setPermissions(payload?.user?.permissions ?? {});
          setError("");
        }
      } catch {
        if (alive) setPermissions({});
        if (alive) setError("无法连接认证服务，请检查网络或 Supabase 配置");
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const key = keyFromPath(pathname);
  if (permissions && error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-10 text-center text-sm font-semibold text-red-800">
        {error}
      </div>
    );
  }

  if (permissions && permissions[key] === false) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-10 text-center text-sm font-semibold text-red-800">
        当前账号没有访问该页面的权限。
      </div>
    );
  }

  return <>{children}</>;
}
