import {
  ClipboardCheck,
  ClipboardList,
  FileClock,
  Package,
  PackageMinus,
  PackagePlus,
  QrCode,
  ShoppingCart,
  SlidersHorizontal,
  Upload,
  Warehouse
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ModuleCard } from "@/components/module-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { inventory, purchaseRequests } from "@/lib/demo-data";

const modules = [
  { href: "/projects", title: "工程项目", description: "项目编码、负责人、用料成本和领料关联。", icon: ClipboardList },
  { href: "/materials", title: "材料档案", description: "材料名称、分类、规格、材质、尺寸和唯一编码。", icon: Package },
  { href: "/purchase-requests", title: "采购申请", description: "项目经理提交缺料申请，等待老板审批。", icon: ClipboardCheck, meta: "2 待处理" },
  { href: "/purchase-orders", title: "采购单", description: "采购员按已审批申请下单并跟踪到货。", icon: ShoppingCart },
  { href: "/inbound", title: "入库", description: "采购到货、工程退料、盘盈和其他来源入库。", icon: PackagePlus },
  { href: "/outbound", title: "出库", description: "强制关联工程项目，库存不足时禁止出库。", icon: PackageMinus },
  { href: "/inventory", title: "库存查询", description: "按规格、库位、项目和低库存筛选。", icon: Warehouse },
  { href: "/logs", title: "操作日志", description: "记录人员、时间、库存变化和照片凭证。", icon: FileClock },
  { href: "/inventory", title: "库存盘点", description: "预留盘点单、盘盈盘亏和库存调整入口。", icon: SlidersHorizontal },
  { href: "/inventory", title: "低库存预警", description: "按分类、库位和最低库存线快速查看缺料。", icon: Warehouse },
  { href: "/materials", title: "Excel 导入材料", description: "预留材料档案批量导入和字段映射。", icon: Upload },
  { href: "/inventory", title: "二维码出入库", description: "预留二维码生成、扫码入库和扫码出库。", icon: QrCode }
];

export default function DashboardPage() {
  return (
    <AppShell title="工作台" subtitle="围绕采购、入库、出库、库存和审计的日常操作入口">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {modules.map((module) => (
          <ModuleCard key={module.href} {...module} />
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-black text-ink">待审批采购</h2>
          <DataTable
            columns={["单号", "工程", "材料", "数量", "状态"]}
            rows={purchaseRequests.map((item) => [
              item.no,
              item.project,
              item.material,
              item.quantity,
              <StatusBadge key={item.no} status={item.status} />
            ])}
          />
        </section>
        <section>
          <h2 className="mb-3 text-lg font-black text-ink">低库存提醒</h2>
          <DataTable
            columns={["材料", "规格", "库位", "库存", "预警"]}
            rows={inventory
              .filter((item) => item.stock <= item.minStock + 2)
              .map((item) => [item.name, item.spec, item.zone, `${item.stock} ${item.unit}`, `${item.minStock} ${item.unit}`])}
          />
        </section>
      </div>
    </AppShell>
  );
}
