import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { parseJsonMeta } from "@/lib/json-meta";
import { drawingLabel, parseProjectNotes, type ProjectDrawing } from "@/lib/project-meta";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type SummaryRow = {
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
  currentStockQty: number;
  unit: string;
};

function keyOf(row: { drawingId: string; materialId: string; specId: string }) {
  return `${row.drawingId || "none"}|${row.materialId}|${row.specId}`;
}

function emptyRow(args: {
  drawings: ProjectDrawing[];
  drawingId: string;
  materialId: string;
  specId: string;
  materialName?: string;
  spec?: string;
  material?: string;
  dimensions?: string;
  unit?: string;
}): SummaryRow {
  return {
    drawingId: args.drawingId,
    drawing: drawingLabel(args.drawings, args.drawingId),
    materialId: args.materialId,
    specId: args.specId,
    materialName: args.materialName ?? "-",
    spec: args.spec ?? "",
    material: args.material ?? "",
    dimensions: args.dimensions ?? "",
    purchasedQty: 0,
    inboundQty: 0,
    outboundQty: 0,
    returnQty: 0,
    currentStockQty: 0,
    unit: args.unit ?? ""
  };
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "缺少项目 ID。" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: project, error: projectError } = await supabase.from("Project").select("*").eq("id", projectId).maybeSingle();
  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 });
  if (!project) return NextResponse.json({ error: "项目不存在。" }, { status: 404 });

  const drawings = parseProjectNotes(project.notes).drawings;
  const [{ data: requests }, { data: inbound }, { data: outbound }, { data: lots }] = await Promise.all([
    supabase
      .from("PurchaseRequest")
      .select("*, PurchaseRequestItem(*, Material(name), MaterialSpec(specModel,materialText,dimensionsText))")
      .eq("projectId", projectId),
    supabase
      .from("InboundRecord")
      .select("*, Material(name), MaterialSpec(specModel,materialText,dimensionsText), UserProfile(name)")
      .eq("projectId", projectId),
    supabase
      .from("OutboundRecord")
      .select("*, Material(name), MaterialSpec(specModel,materialText,dimensionsText), UserProfile(name)")
      .eq("projectId", projectId),
    supabase
      .from("InventoryLot")
      .select("*, Material(name), MaterialSpec(specModel,materialText,dimensionsText)")
      .eq("sourceProjectId", projectId)
  ]);

  const requestIds = (requests ?? []).map((row) => row.id);
  const { data: orders } = requestIds.length
    ? await supabase
      .from("PurchaseOrder")
      .select("*, PurchaseRequest(id,remark), PurchaseOrderItem(*, Material(name), MaterialSpec(specModel,materialText,dimensionsText))")
      .in("purchaseRequestId", requestIds)
    : { data: [] };

  const map = new Map<string, SummaryRow>();
  const upsert = (row: SummaryRow) => {
    const key = keyOf(row);
    const old = map.get(key);
    map.set(key, old ? { ...old, ...row, purchasedQty: old.purchasedQty + row.purchasedQty, inboundQty: old.inboundQty + row.inboundQty, outboundQty: old.outboundQty + row.outboundQty, returnQty: old.returnQty + row.returnQty, currentStockQty: old.currentStockQty + row.currentStockQty, unit: old.unit || row.unit } : row);
  };

  for (const requestRow of requests ?? []) {
    const drawingId = String(parseJsonMeta(requestRow.remark).drawingId ?? "");
    for (const item of requestRow.PurchaseRequestItem ?? []) {
      upsert({
        ...emptyRow({
          drawings,
          drawingId,
          materialId: item.materialId,
          specId: item.specId,
          materialName: item.Material?.name,
          spec: item.MaterialSpec?.specModel,
          material: item.MaterialSpec?.materialText,
          dimensions: item.MaterialSpec?.dimensionsText,
          unit: item.unit
        }),
        purchasedQty: Number(item.quantity ?? 0)
      });
    }
  }

  for (const order of orders ?? []) {
    const drawingId = String(parseJsonMeta(order.PurchaseRequest?.remark).drawingId ?? "");
    for (const item of order.PurchaseOrderItem ?? []) {
      upsert({
        ...emptyRow({
          drawings,
          drawingId,
          materialId: item.materialId,
          specId: item.specId,
          materialName: item.Material?.name,
          spec: item.MaterialSpec?.specModel,
          material: item.MaterialSpec?.materialText,
          dimensions: item.MaterialSpec?.dimensionsText,
          unit: item.unit
        }),
        inboundQty: Number(item.receivedQty ?? 0)
      });
    }
  }

  const returnRecords = [];
  for (const row of inbound ?? []) {
    const meta = parseJsonMeta(row.remark);
    const drawingId = String(meta.drawingId ?? "");
    const isReturn = row.source === "PROJECT_RETURN";
    upsert({
      ...emptyRow({
        drawings,
        drawingId,
        materialId: row.materialId,
        specId: row.specId,
        materialName: row.Material?.name,
        spec: row.MaterialSpec?.specModel,
        material: row.MaterialSpec?.materialText,
        dimensions: row.MaterialSpec?.dimensionsText,
        unit: row.unit
      }),
      inboundQty: isReturn ? 0 : Number(row.quantity ?? 0),
      returnQty: isReturn ? Number(row.quantity ?? 0) : 0
    });
    if (isReturn) {
      returnRecords.push({
        id: row.id,
        inboundNo: row.inboundNo,
        drawing: drawingLabel(drawings, drawingId),
        material: row.Material?.name ?? "-",
        spec: row.MaterialSpec?.specModel ?? "",
        quantity: Number(row.quantity ?? 0),
        unit: row.unit,
        operator: row.UserProfile?.name ?? "-",
        createdAt: row.createdAt
      });
    }
  }

  const outboundRecords = [];
  for (const row of outbound ?? []) {
    const meta = parseJsonMeta(row.remark);
    const drawingId = String(meta.drawingId ?? "");
    upsert({
      ...emptyRow({
        drawings,
        drawingId,
        materialId: row.materialId,
        specId: row.specId,
        materialName: row.Material?.name,
        spec: row.MaterialSpec?.specModel,
        material: row.MaterialSpec?.materialText,
        dimensions: row.MaterialSpec?.dimensionsText,
        unit: row.unit
      }),
      outboundQty: Number(row.quantity ?? 0)
    });
    outboundRecords.push({
      id: row.id,
      outboundNo: row.outboundNo,
      drawing: drawingLabel(drawings, drawingId),
      material: row.Material?.name ?? "-",
      spec: row.MaterialSpec?.specModel ?? "",
      quantity: Number(row.quantity ?? 0),
      unit: row.unit,
      purpose: row.purpose,
      operator: row.UserProfile?.name ?? "-",
      createdAt: row.createdAt
    });
  }

  for (const lot of lots ?? []) {
    upsert({
      ...emptyRow({
        drawings,
        drawingId: "",
        materialId: lot.materialId,
        specId: lot.specId,
        materialName: lot.Material?.name,
        spec: lot.MaterialSpec?.specModel,
        material: lot.MaterialSpec?.materialText,
        dimensions: lot.MaterialSpec?.dimensionsText,
        unit: lot.unit
      }),
      currentStockQty: Number(lot.quantity ?? 0)
    });
  }

  const summary = [...map.values()].map((item) => ({
    ...item,
    remainingQty: Math.max(0, item.inboundQty - item.outboundQty - item.returnQty),
    status: item.returnQty > 0 ? "已有退料" : item.outboundQty > 0 ? "已领料" : item.inboundQty > 0 ? "已入库" : "待采购/入库"
  }));

  return NextResponse.json({
    project,
    drawings,
    summary,
    outboundRecords,
    returnRecords,
    stats: {
      purchasedQty: summary.reduce((sum, item) => sum + item.purchasedQty, 0),
      inboundQty: summary.reduce((sum, item) => sum + item.inboundQty, 0),
      outboundQty: summary.reduce((sum, item) => sum + item.outboundQty, 0),
      returnQty: summary.reduce((sum, item) => sum + item.returnQty, 0),
      remainingQty: summary.reduce((sum, item) => sum + item.remainingQty, 0),
      currentStockQty: summary.reduce((sum, item) => sum + item.currentStockQty, 0),
      materialCost: 0
    }
  });
}
