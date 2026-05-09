import { AppShell } from "@/components/app-shell";

const suppliers = [
  { name: "宁波钢贸", contact: "张经理", phone: "13800000000", address: "宁波", main: "钢材、板材", remark: "采购单供应商字段已可直接填写" },
  { name: "苏州恒力机电", contact: "李经理", phone: "13900000000", address: "苏州", main: "电机、链条、风机", remark: "后续可独立建表" }
];

export default function SuppliersPage() {
  return (
    <AppShell title="供应商管理" subtitle="内部试用版先提供基础入口，采购单已支持供应商名称">
      <div className="grid gap-4">
        <section className="grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-3">
          <input className="field" placeholder="供应商名称" />
          <input className="field" placeholder="联系人/电话" />
          <button className="btn-primary">新增供应商</button>
        </section>
        <div className="grid gap-3 md:grid-cols-2">
          {suppliers.map((item) => (
            <article key={item.name} className="rounded-lg border border-line bg-white p-4">
              <h2 className="font-black text-ink">{item.name}</h2>
              <p className="mt-2 text-sm text-ink/70">{item.contact} / {item.phone}</p>
              <p className="mt-1 text-sm text-ink/70">{item.address}</p>
              <p className="mt-1 text-sm text-ink/70">主营：{item.main}</p>
              <p className="mt-2 text-xs text-ink/50">{item.remark}</p>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
