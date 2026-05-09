import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { writeOperationLog } from "@/lib/audit";
import { compactId, docNo } from "@/lib/ids";
import { stringifyJsonMeta } from "@/lib/json-meta";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { zoneFromLabel } from "@/lib/warehouse-maps";

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  if (!["ADMIN", "BOSS", "WAREHOUSE", "PROJECT_MANAGER"].includes(auth.profile.role)) return NextResponse.json({ error: "无出库权限。" }, { status: 403 });
  const body = (await request.json()) as { projectId?: string; drawingId?: string; materialId?: string; specId?: string; zone?: string; locationCode?: string; quantity?: number; unit?: string; purpose?: string; remark?: string };
  if (!body.projectId || !body.materialId || !body.specId || !body.zone || !body.locationCode || !body.quantity || !body.unit || !body.purpose) return NextResponse.json({ error: "出库必须关联工程，并填写材料、数量、用途。" }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const zone = zoneFromLabel(body.zone);
  const { data: lot } = await supabase.from("InventoryLot").select("*").eq("materialId", body.materialId).eq("specId", body.specId).eq("zone", zone).eq("locationCode", body.locationCode).maybeSingle();
  const beforeQty = Number(lot?.quantity ?? 0);
  if (!lot || beforeQty < Number(body.quantity)) return NextResponse.json({ error: `库存不足，当前库存 ${beforeQty}${body.unit}。` }, { status: 400 });
  const now = new Date().toISOString();
  const afterQty = beforeQty - Number(body.quantity);
  const { data: updatedLot, error: lotError } = await supabase.from("InventoryLot").update({ quantity: afterQty, lastOutboundAt: now, updatedAt: now }).eq("id", lot.id).select("*").single();
  if (lotError) return NextResponse.json({ error: lotError.message }, { status: 500 });
  const { data: record, error } = await supabase.from("OutboundRecord").insert({ id: compactId("out"), outboundNo: docNo("OUT"), materialId: body.materialId, specId: body.specId, projectId: body.projectId, zone, locationCode: body.locationCode, quantity: body.quantity, unit: body.unit, purpose: body.purpose, beforeQty, afterQty, operatorId: auth.profile.id, remark: stringifyJsonMeta({ remark: body.remark || "", drawingId: body.drawingId || "" }), createdAt: now }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeOperationLog({ actorId: auth.profile.id, action: "OUTBOUND", materialId: body.materialId, projectId: body.projectId, remark: "出库扣减库存", before: { lot, beforeQty }, after: { lot: updatedLot, record, afterQty }, extra: { drawingId: body.drawingId || "" } });
  return NextResponse.json({ message: "出库成功，库存已扣减。", record, lot: updatedLot });
}
