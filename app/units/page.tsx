import { AppShell } from "@/components/app-shell";
import { units } from "@/lib/warehouse-maps";

export default function UnitsPage() {
  return (
    <AppShell title="单位管理" subtitle="材料档案已可选择单位，管理员后续可扩展单位字典">
      <div className="grid gap-4">
        <section className="grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-3">
          <input className="field" placeholder="新增单位，例如：箱" />
          <button className="btn-primary">新增单位</button>
        </section>
        <div className="flex flex-wrap gap-2">
          {units.map((unit) => (
            <span key={unit} className="rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-800">{unit}</span>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
