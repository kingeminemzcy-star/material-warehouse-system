import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { writeOperationLog } from "@/lib/audit";
import { compactId } from "@/lib/ids";
import { parseJsonMeta } from "@/lib/json-meta";
import { parseProjectNotes, stringifyProjectNotes, type ProjectDrawing } from "@/lib/project-meta";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isAdminOrBoss } from "@/lib/rbac";

async function linkedCount(supabase: ReturnType<typeof createSupabaseAdminClient>, projectId: string, meta: ReturnType<typeof parseProjectNotes>, drawingId: string) {
  const [{ data: requests }, { data: inbound }, { data: outbound }] = await Promise.all([
    supabase.from("PurchaseRequest").select("remark").eq("projectId", projectId),
    supabase.from("InboundRecord").select("remark").eq("projectId", projectId),
    supabase.from("OutboundRecord").select("remark").eq("projectId", projectId)
  ]);
  return meta.boms.filter((bom) => bom.drawingId === drawingId).length
    + (requests ?? []).filter((row) => parseJsonMeta(row.remark).drawingId === drawingId).length
    + (inbound ?? []).filter((row) => parseJsonMeta(row.remark).drawingId === drawingId).length
    + (outbound ?? []).filter((row) => parseJsonMeta(row.remark).drawingId === drawingId).length;
}

function activeDrawings(drawings: ProjectDrawing[], includeVoided: boolean) {
  return includeVoided ? drawings : drawings.filter((drawing) => !drawing.voided);
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ ok: false, error: "未登录或账号已禁用。" }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ ok: false, error: "缺少项目 ID。" }, { status: 400 });
  const includeVoided = new URL(request.url).searchParams.get("includeVoided") === "true";
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("Project").select("id,notes").eq("id", projectId).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const meta = parseProjectNotes(data?.notes);
  return NextResponse.json({ ok: true, drawings: activeDrawings(meta.drawings, includeVoided) });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ ok: false, error: "未登录或账号已禁用。" }, { status: 401 });
  const body = (await request.json()) as { projectId?: string; drawingNo?: string; name?: string; version?: string; remark?: string };
  if (!body.projectId || !body.drawingNo || !body.name) {
    return NextResponse.json({ ok: false, error: "项目、图号、图纸名称必填。" }, { status: 400 });
  }
  const supabase = createSupabaseAdminClient();
  const { data: before, error: beforeError } = await supabase.from("Project").select("*").eq("id", body.projectId).maybeSingle();
  if (beforeError) return NextResponse.json({ ok: false, error: beforeError.message }, { status: 500 });
  if (!before) return NextResponse.json({ ok: false, error: "项目不存在。" }, { status: 404 });
  const meta = parseProjectNotes(before.notes);
  if (before.status === "COMPLETED") {
    return NextResponse.json({ ok: false, error: "项目已完工，只读状态下不能新增图号。" }, { status: 400 });
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
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  await writeOperationLog({
    actorId: auth.profile.id,
    action: "UPDATE",
    projectId: body.projectId,
    remark: `新增项目图号：${body.drawingNo}`,
    before,
    after,
    extra: { action: "CREATE_PROJECT_DRAWING", drawing }
  });
  return NextResponse.json({ ok: true, message: "项目图号已添加。", drawing });
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ ok: false, error: "未登录或账号已禁用。" }, { status: 401 });
  const body = (await request.json()) as { projectId?: string; drawingId?: string; action?: "update" | "void" | "restore"; drawingNo?: string; name?: string; version?: string; remark?: string; reason?: string };
  if (!body.projectId || !body.drawingId || !body.action) return NextResponse.json({ ok: false, error: "缺少项目、图号或操作类型。" }, { status: 400 });
  if ((body.action === "void" || body.action === "restore") && !isAdminOrBoss(auth.profile.role)) return NextResponse.json({ ok: false, error: "只有老板/管理员可以作废或恢复图号。" }, { status: 403 });
  if ((body.action === "update" || body.action === "void") && !body.reason?.trim()) return NextResponse.json({ ok: false, error: "修改或作废图号必须填写原因。" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: before, error: beforeError } = await supabase.from("Project").select("*").eq("id", body.projectId).maybeSingle();
  if (beforeError) return NextResponse.json({ ok: false, error: beforeError.message }, { status: 500 });
  if (!before) return NextResponse.json({ ok: false, error: "项目不存在。" }, { status: 404 });
  const meta = parseProjectNotes(before.notes);
  const oldDrawing = meta.drawings.find((item) => item.id === body.drawingId);
  if (!oldDrawing) return NextResponse.json({ ok: false, error: "图号不存在。" }, { status: 404 });
  const now = new Date().toISOString();
  const nextDrawing: ProjectDrawing = body.action === "update"
    ? { ...oldDrawing, drawingNo: body.drawingNo || oldDrawing.drawingNo, name: body.name || oldDrawing.name, version: body.version || oldDrawing.version, remark: body.remark ?? oldDrawing.remark }
    : body.action === "void"
      ? { ...oldDrawing, voided: true, voidReason: body.reason || "", voidedAt: now }
      : { ...oldDrawing, voided: false, voidReason: "", restoredAt: now };
  const drawings = meta.drawings.map((item) => item.id === body.drawingId ? nextDrawing : item);
  const { data: after, error } = await supabase.from("Project").update({ notes: stringifyProjectNotes({ ...meta, drawings }), updatedAt: now }).eq("id", body.projectId).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  await writeOperationLog({
    actorId: auth.profile.id,
    action: "UPDATE",
    projectId: body.projectId,
    remark: body.action === "update" ? `修改项目图号：${oldDrawing.drawingNo}` : body.action === "void" ? `作废项目图号：${oldDrawing.drawingNo}` : `恢复项目图号：${oldDrawing.drawingNo}`,
    before: oldDrawing,
    after: nextDrawing,
    extra: { action: `PROJECT_DRAWING_${body.action.toUpperCase()}`, reason: body.reason || "", projectBefore: before, projectAfter: after }
  });
  return NextResponse.json({ ok: true, message: body.action === "update" ? "图号已修改。" : body.action === "void" ? "图号已作废。" : "图号已恢复。", drawing: nextDrawing });
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ ok: false, error: "未登录或账号已禁用。" }, { status: 401 });
  if (!isAdminOrBoss(auth.profile.role)) return NextResponse.json({ ok: false, error: "只有老板/管理员可以删除图号。" }, { status: 403 });
  const body = (await request.json()) as { projectId?: string; drawingId?: string; reason?: string };
  if (!body.projectId || !body.drawingId) return NextResponse.json({ ok: false, error: "缺少项目或图号。" }, { status: 400 });
  if (!body.reason?.trim()) return NextResponse.json({ ok: false, error: "删除或作废图号必须填写原因。" }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data: before, error: beforeError } = await supabase.from("Project").select("*").eq("id", body.projectId).maybeSingle();
  if (beforeError) return NextResponse.json({ ok: false, error: beforeError.message }, { status: 500 });
  if (!before) return NextResponse.json({ ok: false, error: "项目不存在。" }, { status: 404 });
  const meta = parseProjectNotes(before.notes);
  const drawing = meta.drawings.find((item) => item.id === body.drawingId);
  if (!drawing) return NextResponse.json({ ok: false, error: "图号不存在。" }, { status: 404 });
  const now = new Date().toISOString();
  const count = await linkedCount(supabase, body.projectId, meta, body.drawingId);
  const drawings = count > 0
    ? meta.drawings.map((item) => item.id === body.drawingId ? { ...item, voided: true, voidReason: body.reason || "", voidedAt: now } : item)
    : meta.drawings.filter((item) => item.id !== body.drawingId);
  const { data: after, error } = await supabase.from("Project").update({ notes: stringifyProjectNotes({ ...meta, drawings }), updatedAt: now }).eq("id", body.projectId).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  await writeOperationLog({
    actorId: auth.profile.id,
    action: count > 0 ? "UPDATE" : "DELETE",
    projectId: body.projectId,
    remark: count > 0 ? `图号有关联业务，已作废：${drawing.drawingNo}` : `删除项目图号：${drawing.drawingNo}`,
    before: drawing,
    after: count > 0 ? drawings.find((item) => item.id === body.drawingId) : null,
    extra: { action: count > 0 ? "VOID_PROJECT_DRAWING_BY_DELETE" : "DELETE_PROJECT_DRAWING", reason: body.reason, linkedCount: count, projectBefore: before, projectAfter: after }
  });
  return NextResponse.json({ ok: true, message: count > 0 ? "图号已作废，历史记录保留。" : "图号已删除。" });
}
