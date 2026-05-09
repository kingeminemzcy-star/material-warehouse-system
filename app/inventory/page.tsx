import { AppShell } from "@/components/app-shell";
import { InventoryClient } from "./inventory-client";

export default function InventoryPage() {
  return (
    <AppShell title="库存查询" subtitle="按材料、规格、项目、分类、库位和低库存筛选，库存按材料规格和库位独立统计">
      <InventoryClient />
    </AppShell>
  );
}
