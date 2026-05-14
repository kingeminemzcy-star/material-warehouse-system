import { AppShell } from "@/components/app-shell";
import { BomArchiveClient } from "./bom-archive-client";

export default function BomArchivePage() {
  return (
    <AppShell title="BOM 档案库" subtitle="按项目、图号和版本收纳所有 BOM，支持检索、缺料分析和采购联动">
      <BomArchiveClient />
    </AppShell>
  );
}
