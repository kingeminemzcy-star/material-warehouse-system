import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { compactId, docNo } from "@/lib/ids";
import { stringifyJsonMeta } from "@/lib/json-meta";
import { parseProjectNotes } from "@/lib/project-meta";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { zoneFromLabel } from "@/lib/warehouse-maps";

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  if (!["ADMIN", "BOSS", "WAREHOUSE", "PROJECT_MANAGER"].includes(auth.profile.role)) return NextResponse.json({ error: "无出库权限。" }, { status: 403 });
  const body = (await request.json()) as { projectId?: string; drawingId?: string; materialId?: string; specId?: string; zone?: string; locationCode?: string; quantity?: number; unit?: string; purpose?: string; remark?: string };
  if (!body.projectId || !body.drawingId || !body.materialId || !body.specId || !body.zone || !body.locationCode || !body.quantity || !body.unit || !body.purpose) return NextResponse.json({ error: "出库必须关联工程、图号，并填写材料、数量、用途。" }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const zone = zoneFromLabel(body.zone);
  const { data: project, error: projectError } = await supabase.from("Project").select("id,status,notes").eq("id", body.projectId).maybeSingle();
  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 });
  if (!project) return NextResponse.json({ error: "工程项目不存在。" }, { status: 404 });
  if (project.status === "COMPLETED") return NextResponse.json({ error: "项目已完工，只读状态下不能新增出库。" }, { status: 400 });
  const drawings = parseProjectNotes(project.notes).drawings;
  if (!drawings.some((drawing) => drawing.id === body.drawingId)) {
    return NextResponse.json({ error: "出库必须选择该项目下的有效图号。" }, { status: 400 });
  }

  const now = new Date().toISOString();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const lot = await tx.inventoryLot.findFirst({ where: { materialId: body.materialId, specId: body.specId, zone, locationCode: body.locationCode } });
      const beforeQty = Number(lot?.quantity ?? 0);
      if (!lot || beforeQty < Number(body.quantity)) throw new Error(`库存不足，当前库存 ${beforeQty}${body.unit}。`);
      const afterQty = beforeQty - Number(body.quantity);
      const updatedLot = await tx.inventoryLot.update({ where: { id: lot.id }, data: { quantity: afterQty, lastOutboundAt: new Date(now), updatedAt: new Date(now) } });
      const record = await tx.outboundRecord.create({ data: { id: compactId("out"), outboundNo: docNo("OUT"), materialId: body.materialId!, specId: body.specId!, projectId: body.projectId!, zone, locationCode: body.locationCode!, quantity: body.quantity!, unit: body.unit!, purpose: body.purpose!, beforeQty, afterQty, operatorId: auth.profile.id, remark: stringifyJsonMeta({ remark: body.remark || "", drawingId: body.drawingId || "" }), createdAt: new Date(now) } });
      await tx.auditLog.create({ data: { id: compactId("log"), actorId: auth.profile.id, action: "OUTBOUND", materialId: body.materialId, projectId: body.projectId, remark: "出库扣减库存", metadata: { before: { lot, beforeQty }, after: { lot: updatedLot, record, afterQty }, actorId: auth.profile.id, operatedAt: now, drawingId: body.drawingId || "" } } });
      return { record, lot: updatedLot };
    });
    return NextResponse.json({ message: "出库成功，库存已扣减。", ...result });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("库存不足")) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
