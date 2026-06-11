import { AppShell } from "@/components/app-shell";
import { HealthClient } from "./health-client";

export default function HealthPage() {
  return (
    <AppShell title="系统健康检查" subtitle="用于确认 Supabase、数据库、认证和 API 状态，避免把服务暂停误判为数据丢失" skipAccessGuard>
      <HealthClient />
    </AppShell>
  );
}
