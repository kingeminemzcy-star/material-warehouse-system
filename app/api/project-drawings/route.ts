import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { writeOperationLog } from "@/lib/audit";
import { compactId } from "@/lib/ids";
import { parseProjectNotes, stringifyProjectNotes, type ProjectDrawing } from "@/lib/project-meta";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "缺少项目 ID。" }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("Project").select("id,notes").eq("id", projectId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const meta = parseProjectNotes(data?.notes);
  return NextResponse.json({ drawings: meta.drawings });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  const body = (await request.json()) as { projectId?: string; drawingNo?: string; name?: string; version?: string; remark?: string };
  if (!body.projectId || !body.drawingNo || !body.name) {
    return NextResponse.json({ error: "项目、图号、图纸名称必填。" }, { status: 400 });
  }
  const supabase = createSupabaseAdminClient();
  const { data: before, error: beforeError } = await supabase.from("Project").select("*").eq("id", body.projectId).maybeSingle();
  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 500 });
  if (!before) return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
  const meta = parseProjectNotes(before.notes);
  if (before.status === "COMPLETED") {
    return NextResponse.json({ error: "项目已完工，只读状态下不能新增图号。" }, { status: 400 });
  }
  const drawings = meta.drawings.filter((item) => item.drawingNo !== body.drawingNo);
  const drawing: ProjectDrawing = {
    id: compactId("dwg"),
    drawingNo: body.drawingNo,
    name: body.name,
    version: body.version || "A",
    remark: body.remark || "",
    createdAt: new Date().toISOString()
  };
  const afterMeta = { ...meta, drawings: [drawing, ...drawings] };
  const { data: after, error } = await supabase
    .from("Project")
    .update({ notes: stringifyProjectNotes(afterMeta), updatedAt: new Date().toISOString() })
    .eq("id", body.projectId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeOperationLog({
    actorId: auth.profile.id,
    action: "UPDATE",
    projectId: body.projectId,
    remark: `新增项目图号：${body.drawingNo}`,
    before,
    after,
    extra: { action: "CREATE_PROJECT_DRAWING", drawing }
  });
  return NextResponse.json({ message: "项目图号已添加。", drawing });
}
