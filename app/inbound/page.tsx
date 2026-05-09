import { AppShell } from "@/components/app-shell";
import { InboundClient } from "./inbound-client";

export default function InboundPage() {
  return (
    <AppShell title="入库管理" subtitle="可选择采购单入库，也支持工程退料、盘盈和其他手动入库">
      <InboundClient />
    </AppShell>
  );
}
