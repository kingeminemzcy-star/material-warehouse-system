import { Camera } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PhotoUploader } from "@/components/photo-uploader";
import { materials, projects } from "@/lib/demo-data";

const photos = [
  { title: "矩形管到货", material: "矩形管", project: "宁波喷涂线一期", operator: "张仓管", time: "2026-05-09 10:31" },
  { title: "电缆出库", material: "动力电缆", project: "合肥烘干炉配套", operator: "张仓管", time: "2026-05-07 14:42" },
  { title: "油漆退料", material: "环氧底漆", project: "工程退料", operator: "张仓管", time: "2026-05-08 15:20" }
];

export default function PhotosPage() {
  return (
    <AppShell title="照片管理" subtitle="照片可关联材料、工程、入库、出库、操作人和时间">
      <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
        <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
          <h2 className="text-lg font-black text-ink">上传照片</h2>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-2">
              <span className="form-label">关联材料</span>
              <select className="field">
                {materials.map((item) => (
                  <option key={item.code}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="form-label">关联工程</span>
              <select className="field">
                {projects.map((project) => (
                  <option key={project.code}>{project.name}</option>
                ))}
              </select>
            </label>
            <PhotoUploader label="操作照片" />
          </div>
        </section>
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo) => (
            <article key={photo.title} className="rounded-lg border border-line bg-white p-4">
              <div className="flex aspect-[4/3] items-center justify-center rounded-md bg-field text-action">
                <Camera size={40} />
              </div>
              <h2 className="mt-3 font-black text-ink">{photo.title}</h2>
              <p className="mt-1 text-sm text-ink/64">{photo.material} / {photo.project}</p>
              <p className="mt-1 text-xs text-ink/50">{photo.operator} · {photo.time}</p>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
