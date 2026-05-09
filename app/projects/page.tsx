import { AppShell } from "@/components/app-shell";
import { ProjectsClient } from "./projects-client";

export default function ProjectsPage() {
  return (
    <AppShell title="工程项目管理" subtitle="出库、采购申请和退料都必须关联工程项目">
      <ProjectsClient />
    </AppShell>
  );
}
