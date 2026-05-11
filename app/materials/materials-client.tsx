"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, QrCode, Search, Upload } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Field, FormPanel } from "@/components/form-panel";
import { PhotoUploader } from "@/components/photo-uploader";
import { getAuthHeaders } from "@/lib/client-auth";
import { categoryOptions, units } from "@/lib/warehouse-maps";

type MaterialItem = {
  id: string;
  specId: string;
  code: string;
  specCode: string;
  name: string;
  category: string;
  categoryText: string;
  spec: string;
  material: string;
  dimensions: string;
  unit: string;
  minStock: number;
  qrCode: string | null;
};

export function MaterialsClient() {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("全部分类");
  const [location, setLocation] = useState("");
  const [form, setForm] = useState({
    name: "",
    category: "钢材",
    spec: "",
    material: "",
    dimensions: "",
    unit: "根",
    minStock: 0
  });

  async function loadMaterials() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/materials", { headers: await getAuthHeaders(), cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "材料列表加载失败。");
      setLoading(false);
      return;
    }
    setMaterials(payload.materials);
    setLoading(false);
  }

  async function createMaterial() {
    setBusy(true);
    setMessage(null);
    setError(null);
    const response = await fetch("/api/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify(form)
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "材料创建失败。");
      setBusy(false);
      return;
    }
    setMessage(payload.message || "材料档案已创建。");
    setForm({ name: "", category: "钢材", spec: "", material: "", dimensions: "", unit: "根", minStock: 0 });
    await loadMaterials();
    setBusy(false);
  }

  async function importMaterials(file: File) {
    setBusy(true);
    setMessage(null);
    setError(null);
    const text = await file.text();
    const rows = text.split(/\r?\n/).map((line) => line.split(",").map((cell) => cell.replace(/^"|"$/g, "").trim())).filter((row) => row.some(Boolean));
    const [header, ...body] = rows;
    const index = (name: string) => header.findIndex((cell) => cell === name);
    const errors: string[] = [];
    for (const [rowIndex, row] of body.entries()) {
      const payload = {
        name: row[index("材料名称")] || row[index("名称")],
        category: row[index("分类")] || "其他",
        spec: row[index("规格型号")] || row[index("规格")] || "",
        material: row[index("材质")] || "",
        dimensions: row[index("尺寸")] || "",
        unit: row[index("单位")] || "件",
        minStock: Number(row[index("最低库存")] || row[index("低库存预警")] || 0)
      };
      const response = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) errors.push(`第 ${rowIndex + 2} 行：${result.error || "导入失败"}`);
    }
    await loadMaterials();
    setBusy(false);
    if (errors.length) {
      setError(errors.join("；"));
    } else {
      setMessage(`导入完成，共 ${body.length} 条。`);
    }
  }

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const loc = location.trim().toLowerCase();
    return materials.filter((item) => {
      const matchesCategory = category === "全部分类" || item.categoryText === category;
      const haystack = [item.name, item.spec, item.material, item.dimensions, item.categoryText]
        .join(" ")
        .toLowerCase();
      const matchesKeyword = !q || haystack.includes(q);
      const matchesLocation = !loc || haystack.includes(loc);
      return matchesCategory && matchesKeyword && matchesLocation;
    });
  }, [category, keyword, location]);

  useEffect(() => {
    void loadMaterials();
  }, []);

  return (
    <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
      <div className="grid gap-4">
        <FormPanel title="新增材料规格">
          <Field label="材料名称">
            <input className="field" placeholder="例如：矩形管" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="分类">
            <select className="field" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              {categoryOptions.map((item, index) => (
                <option key={`${item.value}-${index}`}>{item.label}</option>
              ))}
            </select>
          </Field>
          <Field label="规格型号">
            <input className="field" placeholder="100x50x4 / YE3-132M" value={form.spec} onChange={(event) => setForm({ ...form, spec: event.target.value })} />
          </Field>
          <Field label="材质">
            <input className="field" placeholder="Q235B / 铜芯 / 灰色" value={form.material} onChange={(event) => setForm({ ...form, material: event.target.value })} />
          </Field>
          <Field label="尺寸字段">
            <input className="field" placeholder="长宽高厚径壁厚等" value={form.dimensions} onChange={(event) => setForm({ ...form, dimensions: event.target.value })} />
          </Field>
          <Field label="单位">
            <select className="field" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>
              {units.map((unit, index) => (
                <option key={`${unit}-${index}`}>{unit}</option>
              ))}
            </select>
          </Field>
          <Field label="低库存预警">
            <input className="field" type="number" placeholder="10" value={form.minStock} onChange={(event) => setForm({ ...form, minStock: Number(event.target.value) })} />
          </Field>
          <Field label="二维码字段">
            <input className="field" placeholder="qr_code 预留" />
          </Field>
          <div className="md:col-span-2">
            <PhotoUploader label="材料档案照片" />
          </div>
          <div className="grid gap-2 md:col-span-2 sm:grid-cols-2">
            <label className="btn-secondary cursor-pointer">
              <Upload size={18} />
              Excel/CSV 导入
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importMaterials(file);
                }}
              />
            </label>
            <button className="btn-primary" disabled={busy} onClick={() => void createMaterial()}>
              {busy ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
              保存档案
            </button>
          </div>
        </FormPanel>
      </div>
      <section className="grid gap-4">
        {message ? <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{message}</div> : null}
        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div> : null}
        <div className="grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-5">
          <input
            className="field md:col-span-2"
            placeholder="名称、规格、材质、尺寸"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <select className="field" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>全部分类</option>
            {categoryOptions.map((item, index) => (
              <option key={`${item.value}-${index}`}>{item.label}</option>
            ))}
          </select>
          <input className="field" placeholder="库位/库区" value={location} onChange={(event) => setLocation(event.target.value)} />
          <button className="btn-primary" type="button">
            <Search size={18} />
            {loading ? "加载中" : `${filtered.length} 条`}
          </button>
        </div>
        {!loading && filtered.length === 0 ? (
          <div className="rounded-lg border border-line bg-white px-4 py-10 text-center text-sm font-semibold text-ink/60">暂无匹配数据</div>
        ) : (
          <DataTable
            columns={["编码", "名称", "分类", "规格", "材质", "尺寸", "单位", "最低库存", "二维码"]}
            rowKeys={filtered.map((item, index) => `${item.specId || item.id || "material"}-${index}`)}
            rows={filtered.map((item) => [
              item.code,
              item.name,
              item.categoryText,
              item.spec,
              item.material,
              item.dimensions,
              item.unit,
              item.minStock,
              item.qrCode ? <img src={item.qrCode} alt="材料二维码" className="h-16 w-16" /> : <QrCode size={28} />
            ])}
          />
        )}
      </section>
    </div>
  );
}
