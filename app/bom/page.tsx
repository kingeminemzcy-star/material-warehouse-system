import { AppShell } from "@/components/app-shell";
import { BomClient } from "./bom-client";

export default function BomPage() {
  return (
    <AppShell title="BOM 中心" subtitle="按项目和图号管理 BOM 版本，自动分析缺料并生成采购申请">
      <BomClient />
    </AppShell>
  );
}
