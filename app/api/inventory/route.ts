import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { writeOperationLog } from "@/lib/audit";
import { compactId } from "@/lib/ids";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { categoryLabels, zoneLabels, zoneFromLabel } from "@/lib/warehouse-maps";

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("InventoryLot")
    .select("*, Material(id,name,category,minStock,unit), MaterialSpec(specModel,materialText,dimensionsText), Project(name)")
    .order("updatedAt", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    inventory: (data ?? []).map((row) => ({
      id: row.id,
      materialId: row.materialId,
      specId: row.specId,
      name: row.Material?.name ?? "-",
      category: row.Material?.category,
      categoryText: categoryLabels[row.Material?.category as keyof typeof categoryLabels] ?? "其他",
      spec: row.MaterialSpec?.specModel ?? "",
      material: row.MaterialSpec?.materialText ?? "",
      dimensions: row.MaterialSpec?.dimensionsText ?? "",
      quantity: Number(row.quantity ?? 0),
      minStock: Number(row.Material?.minStock ?? 0),
      unit: row.unit,
      zone: row.zone,
      zoneText: zoneLabels[row.zone as keyof typeof zoneLabels] ?? row.zone,
      locationCode: row.locationCode,
      project: row.Project?.name ?? "通用库存",
      lastInboundAt: row.lastInboundAt,
      lastOutboundAt: row.lastOutboundAt,
      low: Number(row.quantity ?? 0) < Number(row.Material?.minStock ?? 0)
    }))
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  if (auth.profile.role !== "ADMIN" && auth.profile.role !== "BOSS" && auth.profile.role !== "WAREHOUSE") {
    return NextResponse.json({ error: "只有仓库员或管理员可以盘点调整库存。" }, { status: 403 });
  }
  const body = (await request.json()) as { id?: string; actualQty?: number; reason?: string };
  if (!body.id || body.actualQty === undefined || !body.reason?.trim()) {
    return NextResponse.json({ error: "盘点调整必须提供库存批次、实际数量和原因。" }, { status: 400 });
  }
  const supabase = createSupabaseAdminClient();
  const { data: before } = await supabase.from("InventoryLot").select("*").eq("id", body.id).maybeSingle();
  if (!before) return NextResponse.json({ error: "库存批次不存在。" }, { status: 404 });
  const now = new Date().toISOString();
  const { data: after, error } = await supabase.from("InventoryLot").update({ quantity: body.actualQty, updatedAt: now }).eq("id", body.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeOperationLog({
    actorId: auth.profile.id,
    action: "STOCK_ADJUSTMENT",
    materialId: before.materialId,
    projectId: before.sourceProjectId,
    remark: `库存盘点调整：${body.reason}`,
    before,
    after,
    extra: { beforeQty: before.quantity, actualQty: body.actualQty, diff: Number(body.actualQty) - Number(before.quantity) }
  });
  return NextResponse.json({ message: "库存盘点已调整。", lot: after });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  const body = (await request.json()) as { materialId?: string; specId?: string; zone?: string; locationCode?: string; quantity?: number; unit?: string };
  if (!body.materialId || !body.specId || !body.zone || !body.locationCode || body.quantity === undefined || !body.unit) {
    return NextResponse.json({ error: "库存批次信息不完整。" }, { status: 400 });
  }
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("InventoryLot").insert({
    id: compactId("lot"),
    materialId: body.materialId,
    specId: body.specId,
    zone: zoneFromLabel(body.zone),
    locationCode: body.locationCode,
    quantity: body.quantity,
    unit: body.unit,
    lastInboundAt: now,
    updatedAt: now
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: "库存批次已创建。", lot: data });
}
