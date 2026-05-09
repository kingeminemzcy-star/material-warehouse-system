import { AppShell } from "@/components/app-shell";
import { PurchaseOrdersClient } from "./purchase-orders-client";

export default function PurchaseOrdersPage() {
  return (
    <AppShell title="采购单" subtitle="采购员基于已审批采购申请下单，跟踪部分到货和完成状态">
      <PurchaseOrdersClient />
    </AppShell>
  );
}
