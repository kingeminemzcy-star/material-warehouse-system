import { AppShell } from "@/components/app-shell";
import { MaterialsClient } from "./materials-client";

export default function MaterialsPage() {
  return (
    <AppShell title="材料档案管理" subtitle="名称、分类、规格型号、材质、尺寸字段分开存储，不同规格独立编码">
      <MaterialsClient />
    </AppShell>
  );
}
