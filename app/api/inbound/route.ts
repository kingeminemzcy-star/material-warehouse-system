import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { writeOperationLog } from "@/lib/audit";
import { compactId, docNo } from "@/lib/ids";
import { stringifyJsonMeta } from "@/lib/json-meta";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { inboundSourceFromLabel, zoneFromLabel } from "@/lib/warehouse-maps";

function parseOrderMeta(remark: string | null) {
  if (!remark) return { acceptanceStatus: "NONE" };
  try {
    return { acceptanceStatus: "NONE", ...(JSON.parse(remark) as { acceptanceStatus?: string }) };
  } catch {
    return { acceptanceStatus: "NONE", remark };
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  if (!["ADMIN", "BOSS", "WAREHOUSE"].includes(auth.profile.role)) return NextResponse.json({ error: "无入库权限。" }, { status: 403 });
  const body = (await request.json()) as { purchaseOrderId?: string; materialId?: string; specId?: string; projectId?: string; drawingId?: string; source?: string; zone?: string; locationCode?: string; quantity?: number; unit?: string; remark?: string };
  if (!body.materialId || !body.specId || !body.source || !body.zone || !body.locationCode || !body.quantity || !body.unit) return NextResponse.json({ error: "入库信息不完整。" }, { status: 400 });
  if (inboundSourceFromLabel(body.source) === "PROJECT_RETURN" && !body.projectId) return NextResponse.json({ error: "工程退料必须选择来源工程。" }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const zone = zoneFromLabel(body.zone);

  if (body.purchaseOrderId && inboundSourceFromLabel(body.source) === "PURCHASE_ARRIVAL") {
    const { data: order, error: orderError } = await supabase
      .from("PurchaseOrder")
      .select("id,status,remark,PurchaseOrderItem(id,materialId,specId,quantity,receivedQty)")
      .eq("id", body.purchaseOrderId)
      .maybeSingle();
    if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
    if (!order) return NextResponse.json({ error: "采购单不存在。" }, { status: 404 });
    const meta = parseOrderMeta(order.remark);
    if (meta.acceptanceStatus !== "ACCEPTED") {
      return NextResponse.json({ error: "采购到货必须先完成验收确认，通过后才能入库。" }, { status: 400 });
    }
  }

  const sourceProjectId = body.projectId || null;
  const { data: lot } = sourceProjectId
    ? await supabase.from("InventoryLot").select("*").eq("materialId", body.materialId).eq("specId", body.specId).eq("zone", zone).eq("locationCode", body.locationCode).eq("sourceProjectId", sourceProjectId).maybeSingle()
    : await supabase.from("InventoryLot").select("*").eq("materialId", body.materialId).eq("specId", body.specId).eq("zone", zone).eq("locationCode", body.locationCode).is("sourceProjectId", null).maybeSingle();
  const beforeQty = Number(lot?.quantity ?? 0);
  const afterQty = beforeQty + Number(body.quantity);
  let updatedLot = lot;
  if (lot) {
    const { data, error } = await supabase.from("InventoryLot").update({ quantity: afterQty, lastInboundAt: now, updatedAt: now }).eq("id", lot.id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    updatedLot = data;
  } else {
    const { data, error } = await supabase.from("InventoryLot").insert({ id: compactId("lot"), materialId: body.materialId, specId: body.specId, zone, locationCode: body.locationCode, sourceProjectId, quantity: afterQty, unit: body.unit, lastInboundAt: now, updatedAt: now }).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    updatedLot = data;
  }
  const { data: record, error } = await supabase.from("InboundRecord").insert({ id: compactId("in"), inboundNo: docNo("IN"), purchaseOrderId: body.purchaseOrderId || null, materialId: body.materialId, specId: body.specId, projectId: body.projectId || null, source: inboundSourceFromLabel(body.source), zone, locationCode: body.locationCode, quantity: body.quantity, unit: body.unit, beforeQty, afterQty, operatorId: auth.profile.id, remark: stringifyJsonMeta({ remark: body.remark || "", drawingId: body.drawingId || "" }), createdAt: now }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.purchaseOrderId) {
    const { data: orderItems } = await supabase
      .from("PurchaseOrderItem")
      .select("*")
      .eq("purchaseOrderId", body.purchaseOrderId);
    const matching = orderItems?.find((item) => item.materialId === body.materialId && item.specId === body.specId);
    if (matching) {
      await supabase
        .from("PurchaseOrderItem")
        .update({ receivedQty: Number(matching.receivedQty ?? 0) + Number(body.quantity) })
        .eq("id", matching.id);
    }
    const { data: refreshedItems } = await supabase
      .from("PurchaseOrderItem")
      .select("quantity,receivedQty")
      .eq("purchaseOrderId", body.purchaseOrderId);
    const total = (refreshedItems ?? []).reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
    const received = (refreshedItems ?? []).reduce((sum, item) => sum + Number(item.receivedQty ?? 0), 0);
    await supabase
      .from("PurchaseOrder")
      .update({ status: total > 0 && received >= total ? "COMPLETED" : "PARTIAL_RECEIVED", updatedAt: now })
      .eq("id", body.purchaseOrderId);
  }

  await writeOperationLog({ actorId: auth.profile.id, action: "INBOUND", materialId: body.materialId, projectId: body.projectId, remark: inboundSourceFromLabel(body.source) === "PROJECT_RETURN" ? "项目退料入库，库存增加" : "入库增加库存", before: { lot, beforeQty }, after: { lot: updatedLot, record, afterQty }, extra: { drawingId: body.drawingId || "" } });
  return NextResponse.json({ message: "入库成功，库存已增加。", record, lot: updatedLot });
}
