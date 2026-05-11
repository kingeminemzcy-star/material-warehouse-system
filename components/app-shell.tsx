import Link from "next/link";
import {
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  FileClock,
  Home,
  LogOut,
  Package,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  Users,
  Ruler,
  Truck,
  Warehouse,
  History
} from "lucide-react";
import { CurrentUserCard } from "@/components/current-user-card";
import { LogoMark } from "@/components/logo-mark";
import { VersionFooter } from "@/components/version-footer";

const nav = [
  { href: "/dashboard", label: "首页", icon: Home },
  { href: "/projects", label: "工程项目", icon: ClipboardList },
  { href: "/bom", label: "BOM 中心", icon: FileSpreadsheet },
  { href: "/materials", label: "材料档案", icon: Package },
  { href: "/purchase-requests", label: "采购申请", icon: ClipboardCheck },
  { href: "/approvals", label: "老板审批", icon: ShieldCheck },
  { href: "/purchase-orders", label: "采购单", icon: ShoppingCart },
  { href: "/inbound", label: "入库", icon: PackagePlus },
  { href: "/outbound", label: "出库", icon: PackageMinus },
  { href: "/inventory", label: "库存", icon: Warehouse },
  { href: "/stocktaking", label: "库存盘点", icon: PackageCheck },
  { href: "/logs", label: "操作日志", icon: FileClock },
  { href: "/accounts", label: "账号管理", icon: Users },
  { href: "/suppliers", label: "供应商", icon: Truck },
  { href: "/units", label: "单位管理", icon: Ruler },
  { href: "/photos", label: "照片", icon: PackageCheck },
  { href: "/changelog", label: "更新日志", icon: History }
];

export function AppShell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-line bg-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-4 lg:block">
          <Link href="/dashboard" className="block">
            <div className="flex min-h-12 items-center">
              <LogoMark compact />
            </div>
            <div className="mt-1 text-xs text-ink/60">喷涂生产线设备公司</div>
          </Link>
          <Link href="/login" className="btn-secondary min-h-10 px-3 lg:hidden">
            <LogOut size={18} />
          </Link>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:overflow-visible lg:px-3">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-11 shrink-0 items-center gap-3 rounded-md px-3 text-sm font-semibold text-ink/75 transition hover:bg-field hover:text-ink lg:w-full"
              >
                <Icon size={19} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden border-t border-line p-4 lg:block">
          <CurrentUserCard />
        </div>
      </aside>
      <main className="min-w-0">
        <header className="border-b border-line bg-white/88 px-4 py-4 backdrop-blur md:px-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-normal text-ink md:text-3xl">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-ink/60">{subtitle}</p> : null}
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary">
                <ScanLine size={18} />
                扫码预留
              </button>
            </div>
          </div>
        </header>
        <div className="px-4 py-5 md:px-7">{children}</div>
        <VersionFooter />
      </main>
    </div>
  );
}
