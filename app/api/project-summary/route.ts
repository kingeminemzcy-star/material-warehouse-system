import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { parseJsonMeta } from "@/lib/json-meta";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type Drawing = { id: string; drawingNo: string; name: string; version: string };

function drawingLabel(drawings: Drawing[], drawingId: unknown) {
  const drawing = drawings.find((item) => item.id === drawingId);
  return drawing ? `${drawing.drawingNo} ${drawing.name}` : "未关联图号";
}

function materialKey(row: { materialId: string; specId: string; drawingId: string }) {
  return `${row.drawingId || "none"}|${row.materialId}|${row.specId}`;
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "缺少项目 ID。" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const [{ data: project }, { data: requests }, { data: inbound }, { data: outbound }] = await Promise.all([
    supabase.from("Project").select("*").eq("id", projectId).maybeSingle(),
    supabase.from("PurchaseRequest").select("*, PurchaseRequestItem(*, Material(name), MaterialSpec(specModel,materialText,dimensionsText))").eq("projectId", projectId),
    supabase.from("InboundRecord").select("*, Material(name), MaterialSpec(specModel,materialText,dimensionsText), UserProfile(name)").eq("projectId", projectId),
    supabase.from("OutboundRecord").select("*, Material(name), MaterialSpec(specModel,materialText,dimensionsText), UserProfile(name)").eq("projectId", projectId)
  ]);

  const drawings = ((parseJsonMeta(project?.notes).drawings as Drawing[] | undefined) ?? []);
  const map = new Map<string, {
    drawingId: string;
    drawing: string;
    materialId: string;
    specId: string;
    materialName: string;
    spec: string;
    material: string;
    dimensions: string;
    purchasedQty: number;
    inboundQty: number;
    outboundQty: number;
    returnQty: number;
    unit: string;
  }>();

  for (const requestRow of requests ?? []) {
    const drawingId = String(parseJsonMeta(requestRow.remark).drawingId ?? "");
    for (const item of requestRow.PurchaseRequestItem ?? []) {
      const key = materialKey({ drawingId, materialId: item.materialId, specId: item.specId });
      const old = map.get(key);
      map.set(key, {
        drawingId,
        drawing: drawingLabel(drawings, drawingId),
        materialId: item.materialId,
        specId: item.specId,
        materialName: item.Material?.name ?? "-",
        spec: item.MaterialSpec?.specModel ?? "",
        material: item.MaterialSpec?.materialText ?? "",
        dimensions: item.MaterialSpec?.dimensionsText ?? "",
        purchasedQty: (old?.purchasedQty ?? 0) + Number(item.quantity ?? 0),
        inboundQty: old?.inboundQty ?? 0,
        outboundQty: old?.outboundQty ?? 0,
        returnQty: old?.returnQty ?? 0,
        unit: item.unit
      });
    }
  }

  for (const row of inbound ?? []) {
    const meta = parseJsonMeta(row.remark);
    const drawingId = String(meta.drawingId ?? "");
    const key = materialKey({ drawingId, materialId: row.materialId, specId: row.specId });
    const old = map.get(key);
    map.set(key, {
      drawingId,
      drawing: drawingLabel(drawings, drawingId),
      materialId: row.materialId,
      specId: row.specId,
      materialName: row.Material?.name ?? "-",
      spec: row.MaterialSpec?.specModel ?? "",
      material: row.MaterialSpec?.materialText ?? "",
      dimensions: row.MaterialSpec?.dimensionsText ?? "",
      purchasedQty: old?.purchasedQty ?? 0,
      inboundQty: (old?.inboundQty ?? 0) + Number(row.quantity ?? 0),
      outboundQty: old?.outboundQty ?? 0,
      returnQty: (old?.returnQty ?? 0) + (row.source === "PROJECT_RETURN" ? Number(row.quantity ?? 0) : 0),
      unit: row.unit
    });
  }

  const outboundRows = (outbound ?? []).map((row) => {
    const meta = parseJsonMeta(row.remark);
    const drawingId = String(meta.drawingId ?? "");
    const key = materialKey({ drawingId, materialId: row.materialId, specId: row.specId });
    const old = map.get(key);
    map.set(key, {
      drawingId,
      drawing: drawingLabel(drawings, drawingId),
      materialId: row.materialId,
      specId: row.specId,
      materialName: row.Material?.name ?? "-",
      spec: row.MaterialSpec?.specModel ?? "",
      material: row.MaterialSpec?.materialText ?? "",
      dimensions: row.MaterialSpec?.dimensionsText ?? "",
      purchasedQty: old?.purchasedQty ?? 0,
      inboundQty: old?.inboundQty ?? 0,
      outboundQty: (old?.outboundQty ?? 0) + Number(row.quantity ?? 0),
      returnQty: old?.returnQty ?? 0,
      unit: row.unit
    });
    return {
      id: row.id,
      outboundNo: row.outboundNo,
      drawing: drawingLabel(drawings, drawingId),
      material: row.Material?.name ?? "-",
      spec: row.MaterialSpec?.specModel ?? "",
      quantity: row.quantity,
      unit: row.unit,
      operator: row.UserProfile?.name ?? "-",
      createdAt: row.createdAt
    };
  });

  const summary = [...map.values()].map((item) => ({
    ...item,
    remainingQty: item.inboundQty - item.outboundQty + item.returnQty,
    status: item.outboundQty > 0 ? "已领用" : item.inboundQty > 0 ? "已入库" : "待采购/入库"
  }));

  return NextResponse.json({
    project,
    drawings,
    summary,
    outboundRecords: outboundRows,
    stats: {
      purchasedQty: summary.reduce((sum, item) => sum + item.purchasedQty, 0),
      inboundQty: summary.reduce((sum, item) => sum + item.inboundQty, 0),
      outboundQty: summary.reduce((sum, item) => sum + item.outboundQty, 0),
      returnQty: summary.reduce((sum, item) => sum + item.returnQty, 0),
      remainingQty: summary.reduce((sum, item) => sum + item.remainingQty, 0),
      materialCost: 0
    }
  });
}
