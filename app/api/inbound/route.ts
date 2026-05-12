import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { compactId, docNo } from "@/lib/ids";
import { stringifyJsonMeta } from "@/lib/json-meta";
import { parseProjectNotes } from "@/lib/project-meta";
import { prisma } from "@/lib/prisma";
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
  if (!auth) return NextResponse.json({ ok: false, error: "未登录或账号已禁用。" }, { status: 401 });
  if (!["ADMIN", "BOSS", "WAREHOUSE"].includes(auth.profile.role)) return NextResponse.json({ ok: false, error: "无入库权限。" }, { status: 403 });
  const body = (await request.json()) as { purchaseOrderId?: string; materialId?: string; specId?: string; projectId?: string; drawingId?: string; source?: string; zone?: string; locationCode?: string; quantity?: number; unit?: string; remark?: string };
  if (!body.materialId || !body.specId || !body.source || !body.zone || !body.locationCode || !body.quantity || !body.unit) return NextResponse.json({ ok: false, error: "入库信息不完整。" }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const zone = zoneFromLabel(body.zone);
  const source = inboundSourceFromLabel(body.source);

  if (source === "PROJECT_RETURN" && !body.projectId) return NextResponse.json({ ok: false, error: "工程退料必须选择来源工程。" }, { status: 400 });
  if (body.projectId) {
    const { data: project, error: projectError } = await supabase.from("Project").select("id,status,notes").eq("id", body.projectId).maybeSingle();
    if (projectError) return NextResponse.json({ ok: false, error: projectError.message }, { status: 500 });
    if (!project) return NextResponse.json({ ok: false, error: "工程项目不存在。" }, { status: 404 });
    if (project.status === "COMPLETED") return NextResponse.json({ ok: false, error: "项目已完工，只读状态下不能新增入库/退料记录。" }, { status: 400 });
    const drawings = parseProjectNotes(project.notes).drawings;
    if (source === "PROJECT_RETURN" && !drawings.some((drawing) => drawing.id === body.drawingId)) {
      return NextResponse.json({ ok: false, error: "项目退料入库必须选择有效图号。" }, { status: 400 });
    }
    if (source !== "PROJECT_RETURN" && drawings.length > 0 && body.drawingId && !drawings.some((drawing) => drawing.id === body.drawingId)) {
      return NextResponse.json({ ok: false, error: "请选择该项目下的有效图号。" }, { status: 400 });
    }
  }

  if (body.purchaseOrderId && source === "PURCHASE_ARRIVAL") {
    const { data: order, error: orderError } = await supabase
      .from("PurchaseOrder")
      .select("id,status,remark,PurchaseOrderItem(id,materialId,specId,quantity,receivedQty)")
      .eq("id", body.purchaseOrderId)
      .maybeSingle();
    if (orderError) return NextResponse.json({ ok: false, error: orderError.message }, { status: 500 });
    if (!order) return NextResponse.json({ ok: false, error: "采购单不存在。" }, { status: 404 });
    const meta = parseOrderMeta(order.remark);
    if (meta.acceptanceStatus !== "ACCEPTED") {
      return NextResponse.json({ ok: false, error: "采购到货必须先完成验收确认，通过后才能入库。" }, { status: 400 });
    }
  }

  const sourceProjectId = body.projectId || null;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const lot = await tx.inventoryLot.findFirst({ where: { materialId: body.materialId, specId: body.specId, zone, locationCode: body.locationCode, sourceProjectId } });
      const beforeQty = Number(lot?.quantity ?? 0);
      const afterQty = beforeQty + Number(body.quantity);
      const updatedLot = lot
        ? await tx.inventoryLot.update({ where: { id: lot.id }, data: { quantity: afterQty, lastInboundAt: new Date(now), updatedAt: new Date(now) } })
        : await tx.inventoryLot.create({ data: { id: compactId("lot"), materialId: body.materialId!, specId: body.specId!, zone, locationCode: body.locationCode!, sourceProjectId, quantity: afterQty, unit: body.unit!, lastInboundAt: new Date(now), updatedAt: new Date(now) } });
      const record = await tx.inboundRecord.create({ data: { id: compactId("in"), inboundNo: docNo("IN"), purchaseOrderId: body.purchaseOrderId || null, materialId: body.materialId!, specId: body.specId!, projectId: body.projectId || null, source, zone, locationCode: body.locationCode!, quantity: body.quantity!, unit: body.unit!, beforeQty, afterQty, operatorId: auth.profile.id, remark: stringifyJsonMeta({ remark: body.remark || "", drawingId: body.drawingId || "" }), createdAt: new Date(now) } });
      if (body.purchaseOrderId) {
        const matching = await tx.purchaseOrderItem.findFirst({ where: { purchaseOrderId: body.purchaseOrderId, materialId: body.materialId, specId: body.specId } });
        if (matching) {
          const nextReceived = Number(matching.receivedQty ?? 0) + Number(body.quantity);
          if (nextReceived > Number(matching.quantity ?? 0)) throw new Error("DUPLICATE_INBOUND");
          await tx.purchaseOrderItem.update({ where: { id: matching.id }, data: { receivedQty: nextReceived } });
        }
        const refreshedItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: body.purchaseOrderId }, select: { quantity: true, receivedQty: true } });
        const total = refreshedItems.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
        const received = refreshedItems.reduce((sum, item) => sum + Number(item.receivedQty ?? 0), 0);
        await tx.purchaseOrder.update({ where: { id: body.purchaseOrderId }, data: { status: total > 0 && received >= total ? "COMPLETED" : "PARTIAL_RECEIVED", updatedAt: new Date(now) } });
      }
      await tx.auditLog.create({ data: { id: compactId("log"), actorId: auth.profile.id, action: "INBOUND", materialId: body.materialId, projectId: body.projectId || null, remark: source === "PROJECT_RETURN" ? "项目退料入库，库存增加" : "入库增加库存", metadata: { before: { lot, beforeQty }, after: { lot: updatedLot, record, afterQty }, actorId: auth.profile.id, operatedAt: now, drawingId: body.drawingId || "", source } } });
      return { record, lot: updatedLot };
    });
    return NextResponse.json({ ok: true, message: "入库成功，库存已增加。", ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_INBOUND") {
      return NextResponse.json({ ok: false, error: "入库数量超过采购单未入库数量，禁止重复入库。" }, { status: 409 });
    }
    throw error;
  }
}
