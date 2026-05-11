import { AppShell } from "@/components/app-shell";
import { ProjectDetailClient } from "./project-detail-client";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell title="项目材料闭环" subtitle="图号、采购、入库、领料、退料和完工统计">
      <ProjectDetailClient projectId={id} />
    </AppShell>
  );
}
