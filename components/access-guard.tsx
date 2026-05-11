"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getAuthHeaders } from "@/lib/client-auth";

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
    materials: "materials",
    inbound: "inbound",
    outbound: "outbound",
    inventory: "inventory",
    suppliers: "suppliers",
    units: "units",
    photos: "photos",
    changelog: "dashboard",
    dashboard: "dashboard"
  };
  return map[segment] ?? "dashboard";
}

export function AccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [permissions, setPermissions] = useState<Permissions | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const response = await fetch("/api/me", { headers: await getAuthHeaders(), cache: "no-store" });
      if (!response.ok) {
        if (alive) setPermissions({});
        return;
      }
      const payload = await response.json();
      if (alive) setPermissions(payload.user?.permissions ?? {});
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const key = keyFromPath(pathname);
  if (permissions && permissions[key] === false) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-10 text-center text-sm font-semibold text-red-800">
        当前账号没有访问该页面的权限。
      </div>
    );
  }

  return <>{children}</>;
}
