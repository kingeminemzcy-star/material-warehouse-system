import { AppShell } from "@/components/app-shell";
import { LogsClient } from "./logs-client";

export default function LogsPage() {
  return (
    <AppShell title="操作记录/审计日志" subtitle="普通用户不能删除日志，老板和管理员可查看全部关键操作">
      <LogsClient />
    </AppShell>
  );
}
