import { AppShell } from "@/components/app-shell";
import { ApprovalClient } from "./approval-client";

export default function ApprovalsPage() {
  return (
    <AppShell title="老板审批" subtitle="老板/管理员审批采购申请，同意后采购员才能生成采购单">
      <ApprovalClient />
    </AppShell>
  );
}
