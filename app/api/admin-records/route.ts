import { NextRequest, NextResponse } from "next/server";
import { canManageAccounts, getAuthContext } from "@/lib/auth";
import { writeOperationLog } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const editableTables = {
  project: "Project",
  material: "Material",
  materialSpec: "MaterialSpec",
  purchaseRequest: "PurchaseRequest",
  purchaseOrder: "PurchaseOrder",
  inboundRecord: "InboundRecord",
  outboundRecord: "OutboundRecord",
  inventoryLot: "InventoryLot",
  userProfile: "UserProfile"
} as const;

type EditableEntity = keyof typeof editableTables;

export async function PATCH(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  if (!canManageAccounts(auth.profile.role)) {
    return NextResponse.json({ error: "只有老板/管理员可以修改已确认关键记录。" }, { status: 403 });
  }

  const body = (await request.json()) as {
    entity?: EditableEntity;
    id?: string;
    patch?: Record<string, unknown>;
    reason?: string;
    unlockConfirmed?: boolean;
  };

  if (!body.entity || !body.id || !body.patch || !body.reason?.trim()) {
    return NextResponse.json({ error: "缺少修改对象、记录 ID、修改内容或修改原因。" }, { status: 400 });
  }

  const table = editableTables[body.entity];
  if (!table) return NextResponse.json({ error: "不支持的修改对象。" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: before, error: beforeError } = await supabase.from(table).select("*").eq("id", body.id).maybeSingle();
  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 500 });
  if (!before) return NextResponse.json({ error: "记录不存在。" }, { status: 404 });
  const beforeRecord = before as Record<string, unknown>;
  const locked =
    (body.entity === "purchaseRequest" && beforeRecord.status !== "PENDING_APPROVAL")
    || body.entity === "inboundRecord"
    || body.entity === "outboundRecord"
    || (body.entity === "project" && beforeRecord.status === "COMPLETED")
    || body.entity === "purchaseOrder";
  if (locked && !body.unlockConfirmed) {
    return NextResponse.json({ error: "该记录处于锁定状态，仅老板/管理员二次确认解锁后可修改。" }, { status: 423 });
  }

  const patch = {
    ...body.patch,
    ...("updatedAt" in (before as Record<string, unknown>) ? { updatedAt: new Date().toISOString() } : {})
  };
  const { data: after, error: updateError } = await supabase.from(table).update(patch).eq("id", body.id).select("*").single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await writeOperationLog({
    actorId: auth.profile.id,
    action: "UPDATE",
    materialId: body.entity === "material" || body.entity === "materialSpec" ? body.id : null,
    projectId: body.entity === "project" ? body.id : null,
    remark: `管理员修改 ${table}：${body.reason}`,
    before,
    after,
    extra: { entity: body.entity, recordId: body.id }
  });

  return NextResponse.json({ message: "记录已修改，并已写入操作日志。", before, after });
}
