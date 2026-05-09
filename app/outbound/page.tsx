import { AppShell } from "@/components/app-shell";
import { OutboundClient } from "./outbound-client";

export default function OutboundPage() {
  return (
    <AppShell title="出库管理" subtitle="出库必须关联工程项目，提交前检查当前库存，库存不足禁止出库">
      <OutboundClient />
    </AppShell>
  );
}
