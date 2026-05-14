import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { writeOperationLog } from "@/lib/audit";
import { compactId, docNo } from "@/lib/ids";
import { stringifyJsonMeta } from "@/lib/json-meta";
import { buildMaterialCode, inferMaterialCategory, normalizeMaterialKey } from "@/lib/material-code";
import { parseProjectNotes, stringifyProjectNotes, type BomRow, type ProjectBom } from "@/lib/project-meta";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isAdminOrBoss } from "@/lib/rbac";

type RawBomRow = {
  drawingNo?: string;
  materialName?: string;
  spec?: string;
  material?: string;
  unit?: string;
  quantity?: number;
  remark?: string;
};
type BomMetaInput = {
  fileName?: string;
  projectCode?: string;
  orderPerson?: string;
  orderDate?: string;
};
type CreatedPurchaseRequest = {
  id: string;
  requestNo: string;
  projectId: string;
  applicantId: string;
  status: string;
  purpose: string;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
};

function rowKey(row: RawBomRow) {
  return normalizeMaterialKey({ name: row.materialName, spec: row.spec, material: row.material, unit: row.unit });
}

async function loadMaterialIndex() {
  const supabase = createSupabaseAdminClient();
  const [{ data: materials }, { data: specs }, { data: inventory }] = await Promise.all([
    supabase.from("Material").select("*"),
    supabase.from("MaterialSpec").select("*"),
    supabase.from("InventoryLot").select("materialId,specId,quantity")
  ]);
  const materialById = new Map((materials ?? []).map((item) => [item.id, item]));
  const byCode = new Map<string, { materialId: string; specId: string }>();
  const byKey = new Map<string, { materialId: string; specId: string }>();
  for (const spec of specs ?? []) {
    const material = materialById.get(spec.materialId);
    if (!material) continue;
    byCode.set(material.materialCode, { materialId: material.id, specId: spec.id });
    byKey.set(normalizeMaterialKey({ name: material.name, spec: spec.specModel, material: spec.materialText, unit: material.unit }), { materialId: material.id, specId: spec.id });
  }
  const stock = new Map<string, number>();
  for (const lot of inventory ?? []) {
    const key = `${lot.materialId}|${lot.specId}`;
    stock.set(key, (stock.get(key) ?? 0) + Number(lot.quantity ?? 0));
  }
  return { byCode, byKey, stock };
}

function analyzeBom(bom: ProjectBom, stock: Map<string, number>) {
  return bom.rows.map((row) => {
    const currentStock = row.matchedMaterialId && row.matchedSpecId ? stock.get(`${row.matchedMaterialId}|${row.matchedSpecId}`) ?? 0 : 0;
    const shortageQty = Math.max(0, row.quantity - currentStock);
    return {
      ...row,
      currentStock,
      shortageQty,
      matchStatus: row.matchedMaterialId && row.matchedSpecId ? "已匹配" : "未匹配"
    };
  });
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ ok: false, error: "未登录或账号已禁用。" }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ ok: false, error: "缺少项目 ID。" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: project, error } = await supabase.from("Project").select("*").eq("id", projectId).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!project) return NextResponse.json({ ok: false, error: "项目不存在。" }, { status: 404 });
  const notes = parseProjectNotes(project.notes);
  const { stock } = await loadMaterialIndex();
  return NextResponse.json({
    ok: true,
    project,
    drawings: notes.drawings,
    boms: notes.boms.map((bom) => ({
      ...bom,
      analysis: analyzeBom(bom, stock)
    }))
  });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ ok: false, error: "未登录或账号已禁用。" }, { status: 401 });
  const body = (await request.json()) as { projectId?: string; drawingNo?: string; version?: string; rows?: RawBomRow[]; meta?: BomMetaInput };
  if (!body.projectId || !body.drawingNo || !body.version || !body.rows?.length) {
    return NextResponse.json({ ok: false, error: "项目、图号、版本和 BOM 明细必填。" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: before, error: beforeError } = await supabase.from("Project").select("*").eq("id", body.projectId).maybeSingle();
  if (beforeError) return NextResponse.json({ ok: false, error: beforeError.message }, { status: 500 });
  if (!before) return NextResponse.json({ ok: false, error: "项目不存在。" }, { status: 404 });
  if (before.status === "COMPLETED") return NextResponse.json({ ok: false, error: "项目已完工，只读状态下不能上传 BOM。" }, { status: 400 });

  const notes = parseProjectNotes(before.notes);
  const now = new Date().toISOString();
  let drawing = notes.drawings.find((item) => item.drawingNo === body.drawingNo);
  let drawings = notes.drawings;
  if (!drawing) {
    drawing = { id: compactId("dwg"), drawingNo: body.drawingNo, name: `${body.drawingNo} BOM`, version: body.version, remark: "BOM 上传自动创建图号", createdAt: now };
    drawings = [drawing, ...drawings];
  } else if (drawing.voided) {
    drawing = { ...drawing, voided: false, restoredAt: now, remark: [drawing.remark, "BOM 上传自动恢复图号"].filter(Boolean).join("；") };
    drawings = drawings.map((item) => item.id === drawing!.id ? drawing! : item);
  }
  for (const drawingNo of [...new Set(body.rows.map((row) => row.drawingNo).filter(Boolean) as string[])]) {
    if (drawings.some((item) => item.drawingNo === drawingNo)) continue;
    drawings = [{ id: compactId("dwg"), drawingNo, name: `${drawingNo} BOM`, version: body.version, remark: "BOM 明细自动创建图号", createdAt: now }, ...drawings];
  }

  const { byCode, byKey, stock } = await loadMaterialIndex();
  const rows: BomRow[] = body.rows.map((row) => {
    const category = inferMaterialCategory(`${row.materialName || ""} ${row.spec || ""}`);
    const materialCode = buildMaterialCode({ category, material: row.material, spec: row.spec, dimensions: "" });
    const matched = byCode.get(materialCode) ?? byKey.get(rowKey(row));
    return {
      id: compactId("bomr"),
      drawingNo: row.drawingNo || body.drawingNo!,
      materialName: row.materialName || "",
      spec: row.spec || "",
      material: row.material || "",
      unit: row.unit || "件",
      quantity: Number(row.quantity ?? 0),
      remark: row.remark || "",
      materialCode,
      matchedMaterialId: matched?.materialId,
      matchedSpecId: matched?.specId
    };
  }).filter((row) => row.materialName && row.quantity > 0);

  const bom: ProjectBom = {
    id: compactId("bom"),
    projectId: body.projectId,
    drawingId: drawing.id,
    drawingNo: body.drawingNo,
    fileName: body.meta?.fileName || `${body.drawingNo}-${body.version}`,
    version: body.version,
    isCurrent: true,
    uploadedAt: now,
    uploadedBy: auth.profile.id,
    uploadedByName: auth.profile.name,
    projectCode: body.meta?.projectCode || before.code,
    orderPerson: body.meta?.orderPerson || "",
    orderDate: body.meta?.orderDate || "",
    rows
  };
  const boms = [bom, ...notes.boms.map((item) => item.drawingId === drawing.id ? { ...item, isCurrent: false } : item)];
  const { data: after, error } = await supabase
    .from("Project")
    .update({ notes: stringifyProjectNotes({ ...notes, drawings, boms }), updatedAt: now })
    .eq("id", body.projectId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await writeOperationLog({
    actorId: auth.profile.id,
    action: "UPDATE",
    projectId: body.projectId,
    remark: `上传 BOM：${body.drawingNo} / ${body.version}`,
    before,
    after,
    extra: { action: "UPLOAD_BOM", bomId: bom.id }
  });

  return NextResponse.json({ ok: true, message: "BOM 已上传并解析。", bom: { ...bom, analysis: analyzeBom(bom, stock) } });
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ ok: false, error: "未登录或账号已禁用。" }, { status: 401 });
  const body = (await request.json()) as { projectId?: string; bomId?: string; action?: "setCurrent" | "generatePurchase"; reason?: string; confirmed?: boolean };
  if (!body.projectId || !body.bomId || !body.action) return NextResponse.json({ ok: false, error: "缺少项目、BOM 或操作类型。" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: before, error: beforeError } = await supabase.from("Project").select("*").eq("id", body.projectId).maybeSingle();
  if (beforeError) return NextResponse.json({ ok: false, error: beforeError.message }, { status: 500 });
  if (!before) return NextResponse.json({ ok: false, error: "项目不存在。" }, { status: 404 });
  if (before.status === "COMPLETED") return NextResponse.json({ ok: false, error: "项目已完工，只读状态下不能操作 BOM。" }, { status: 400 });
  const notes = parseProjectNotes(before.notes);
  const bom = notes.boms.find((item) => item.id === body.bomId);
  if (!bom) return NextResponse.json({ ok: false, error: "BOM 不存在。" }, { status: 404 });
  const now = new Date().toISOString();

  if (body.action === "setCurrent") {
    if (!isAdminOrBoss(auth.profile.role) && !body.confirmed) {
      return NextResponse.json({ ok: false, error: "已发布 BOM 版本受锁定保护，切换当前版本必须二次确认。" }, { status: 423 });
    }
    const boms = notes.boms.map((item) => item.drawingId === bom.drawingId ? { ...item, isCurrent: item.id === bom.id } : item);
    const { data: after, error } = await supabase.from("Project").update({ notes: stringifyProjectNotes({ ...notes, boms }), updatedAt: now }).eq("id", body.projectId).select("*").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await writeOperationLog({ actorId: auth.profile.id, action: "UPDATE", projectId: body.projectId, remark: `切换当前 BOM：${bom.drawingNo} / ${bom.version}`, before, after, extra: { action: "SET_CURRENT_BOM", bomId: bom.id } });
    return NextResponse.json({ ok: true, message: "当前 BOM 版本已切换。" });
  }

  if (!body.confirmed || !body.reason?.trim()) {
    return NextResponse.json({ ok: false, error: "BOM 自动生成采购申请必须二次确认并填写原因。" }, { status: 400 });
  }

  const { stock } = await loadMaterialIndex();
  const shortageRows = analyzeBom(bom, stock).filter((row) => row.shortageQty > 0 && row.matchedMaterialId && row.matchedSpecId);
  const skipped = analyzeBom(bom, stock).filter((row) => row.shortageQty > 0 && (!row.matchedMaterialId || !row.matchedSpecId));
  if (shortageRows.length === 0) {
    return NextResponse.json({ ok: true, message: skipped.length ? "存在未匹配材料，请先创建材料档案。" : "当前 BOM 无缺料，无需生成采购申请。", skipped });
  }

  const created: CreatedPurchaseRequest[] = [];
  for (const row of shortageRows) {
    const requestId = compactId("pr");
    const { data: purchaseRequest, error } = await supabase.from("PurchaseRequest").insert({
      id: requestId,
      requestNo: docNo("PR"),
      projectId: body.projectId,
      applicantId: auth.profile.id,
      status: "PENDING_APPROVAL",
      purpose: `BOM缺料：${bom.drawingNo}`,
      remark: stringifyJsonMeta({ remark: `由 BOM ${bom.version} 自动生成`, drawingId: bom.drawingId, bomId: bom.id }),
      createdAt: now,
      updatedAt: now
    }).select("*").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const { error: itemError } = await supabase.from("PurchaseRequestItem").insert({
      id: compactId("pri"),
      purchaseRequestId: requestId,
      materialId: row.matchedMaterialId,
      specId: row.matchedSpecId,
      quantity: row.shortageQty,
      unit: row.unit,
      purpose: `BOM缺料：${bom.drawingNo}`,
      remark: row.remark || null
    });
    if (itemError) return NextResponse.json({ ok: false, error: itemError.message }, { status: 500 });
    created.push(purchaseRequest as CreatedPurchaseRequest);
  }

  const boms = notes.boms.map((item) => item.id === body.bomId ? { ...item, purchaseGeneratedAt: now, purchaseRequestIds: [...new Set([...(item.purchaseRequestIds ?? []), ...created.map((requestRow) => requestRow.id)])] } : item);
  const { error: updateError } = await supabase.from("Project").update({ notes: stringifyProjectNotes({ ...notes, boms }), updatedAt: now }).eq("id", body.projectId);
  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

  await writeOperationLog({
    actorId: auth.profile.id,
    action: "PURCHASE_REQUEST",
    projectId: body.projectId,
    remark: `BOM 缺料自动生成采购申请：${created.length} 条`,
    before: bom,
    after: { created, bom: boms.find((item) => item.id === body.bomId) },
    extra: { action: "BOM_GENERATE_PURCHASE", bomId: bom.id, skipped }
  });

  return NextResponse.json({ ok: true, message: `已生成 ${created.length} 条采购申请。`, created, skipped });
}
