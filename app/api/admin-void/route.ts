import { NextRequest, NextResponse } from "next/server";
import { canManageAccounts, getAuthContext } from "@/lib/auth";
import { writeOperationLog } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const voidableTables = {
  project: "Project",
  purchaseOrder: "PurchaseOrder",
  inboundRecord: "InboundRecord",
  outboundRecord: "OutboundRecord"
} as const;

type VoidableEntity = keyof typeof voidableTables;

function appendVoidMarker(record: Record<string, unknown>, reason: string, actorId: string) {
  const now = new Date().toISOString();
  const marker = { voided: true, voidReason: reason, voidedAt: now, voidedBy: actorId };
  const timestampPatch = "updatedAt" in record ? { updatedAt: now } : {};

  if ("notes" in record) {
    let existing: Record<string, unknown> = {};
    try {
      existing = record.notes ? JSON.parse(String(record.notes)) : {};
    } catch {
      existing = { remark: record.notes };
    }
    return { notes: JSON.stringify({ ...existing, ...marker }), ...timestampPatch };
  }

  let existing: Record<string, unknown> = {};
  try {
    existing = record.remark ? JSON.parse(String(record.remark)) : {};
  } catch {
    existing = { remark: record.remark };
  }
  return { remark: JSON.stringify({ ...existing, ...marker }), ...timestampPatch };
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  if (!canManageAccounts(auth.profile.role)) {
    return NextResponse.json({ error: "只有老板/管理员可以作废关键业务记录。" }, { status: 403 });
  }

  const body = (await request.json()) as { entity?: VoidableEntity; id?: string; reason?: string };
  if (!body.entity || !body.id || !body.reason?.trim()) {
    return NextResponse.json({ error: "作废必须提供对象、记录 ID 和原因。" }, { status: 400 });
  }

  const table = voidableTables[body.entity];
  if (!table) return NextResponse.json({ error: "不支持的作废对象。" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: before, error: beforeError } = await supabase.from(table).select("*").eq("id", body.id).maybeSingle();
  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 500 });
  if (!before) return NextResponse.json({ error: "记录不存在。" }, { status: 404 });

  const patch = appendVoidMarker(before as Record<string, unknown>, body.reason, auth.profile.id);
  const { data: after, error } = await supabase.from(table).update(patch).eq("id", body.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeOperationLog({
    actorId: auth.profile.id,
    action: "DELETE",
    projectId: body.entity === "project" ? body.id : null,
    remark: `管理员作废 ${table}：${body.reason}`,
    before,
    after,
    extra: { entity: body.entity, recordId: body.id, voided: true }
  });

  return NextResponse.json({ message: "记录已作废，并已写入操作日志。", record: after });
}
