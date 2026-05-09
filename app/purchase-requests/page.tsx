import { AppShell } from "@/components/app-shell";
import { PurchaseRequestsClient } from "./purchase-requests-client";

export default function PurchaseRequestsPage() {
  return (
    <AppShell title="采购申请" subtitle="项目经理或员工提交，必须关联工程项目，等待老板审批">
      <PurchaseRequestsClient />
    </AppShell>
  );
}
