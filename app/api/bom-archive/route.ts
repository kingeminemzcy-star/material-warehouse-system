import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { writeOperationLog } from "@/lib/audit";
import { compactId, docNo } from "@/lib/ids";
import { parseJsonMeta, stringifyJsonMeta } from "@/lib/json-meta";
import { normalizeMaterialKey } from "@/lib/material-code";
import { parseProjectNotes, stringifyProjectNotes, type ProjectBom, type ProjectDrawing } from "@/lib/project-meta";
import { hasPermission, isAdminOrBoss } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ProjectRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  notes: string | null;
  updatedAt?: string;
};

type MaterialRow = {
  id: string;
  name: string;
  materialCode: string;
  unit: string;
};

type MaterialSpecRow = {
  id: string;
  materialId: string;
  specModel: string;
  materialText: string | null;
};

type InventoryLotRow = {
  materialId: string;
  specId: string;
  quantity: number | string;
};

type PurchaseRequestRow = {
  id: string;
  requestNo: string;
  projectId: string;
  status: string;
  purpose: string;
  remark: string | null;
  createdAt: string;
};

type AuditLogRow = {
  id: string;
  actorId: string;
  action: string;
  projectId: string | null;
  remark: string | null;
  metadata: unknown;
  createdAt: string;
  actor?: { name?: string | null } | null;
};

type BomArchiveItem = ProjectBom & {
  projectName: string;
  projectCode: string;
  projectStatus: string;
  drawingName: string;
  drawingVersion: string;
  drawingRemark: string;
  drawingVoided: boolean;
  detailCount: number;
  shortageCount: number;
  shortageQty: number;
  analysis: ReturnType<typeof analyzeBom>;
  linkedPurchaseRequests: PurchaseRequestRow[];
  logs: AuditLogRow[];
};

function stockKey(materialId?: string, specId?: string) {
  return materialId && specId ? `${materialId}|${specId}` : "";
}

async function loadMaterialIndex() {
  const supabase = createSupabaseAdminClient();
  const [{ data: materials }, { data: specs }, { data: inventory }] = await Promise.all([
    supabase.from("Material").select("id,name,materialCode,unit"),
    supabase.from("MaterialSpec").select("id,materialId,specModel,materialText"),
    supabase.from("InventoryLot").select("materialId,specId,quantity")
  ]);

  const materialById = new Map((materials as MaterialRow[] | null ?? []).map((item) => [item.id, item]));
  const byKey = new Map<string, { materialId: string; specId: string }>();
  const byCode = new Map<string, { materialId: string; specId: string }>();
  for (const spec of (specs as MaterialSpecRow[] | null) ?? []) {
    const material = materialById.get(spec.materialId);
    if (!material) continue;
    byCode.set(material.materialCode, { materialId: material.id, specId: spec.id });
    byKey.set(normalizeMaterialKey({ name: material.name, spec: spec.specModel, material: spec.materialText ?? "", unit: material.unit }), { materialId: material.id, specId: spec.id });
  }

  const stock = new Map<string, number>();
  for (const lot of (inventory as InventoryLotRow[] | null) ?? []) {
    const key = stockKey(lot.materialId, lot.specId);
    stock.set(key, (stock.get(key) ?? 0) + Number(lot.quantity ?? 0));
  }
  return { byCode, byKey, stock };
}

function enrichBomMatch(bom: ProjectBom, index: Awaited<ReturnType<typeof loadMaterialIndex>>) {
  const rows = bom.rows.map((row) => {
    if (row.matchedMaterialId && row.matchedSpecId) return row;
    const matched = index.byCode.get(row.materialCode) ?? index.byKey.get(normalizeMaterialKey({ name: row.materialName, spec: row.spec, material: row.material, unit: row.unit }));
    return matched ? { ...row, matchedMaterialId: matched.materialId, matchedSpecId: matched.specId } : row;
  });
  return { ...bom, rows };
}

function analyzeBom(bom: ProjectBom, stock: Map<string, number>) {
  if (bom.voided) {
    return bom.rows.map((row) => ({
      ...row,
      currentStock: 0,
      shortageQty: 0,
      matchStatus: row.matchedMaterialId && row.matchedSpecId ? "已匹配" : "未匹配",
      skippedReason: "BOM 已作废，不参与缺料分析"
    }));
  }
  return bom.rows.map((row) => {
    const currentStock = row.matchedMaterialId && row.matchedSpecId ? stock.get(stockKey(row.matchedMaterialId, row.matchedSpecId)) ?? 0 : 0;
    const shortageQty = row.matchedMaterialId && row.matchedSpecId ? Math.max(0, Number(row.quantity ?? 0) - currentStock) : Math.max(0, Number(row.quantity ?? 0));
    return {
      ...row,
      currentStock,
      shortageQty,
      matchStatus: row.matchedMaterialId && row.matchedSpecId ? "已匹配" : "未匹配",
      skippedReason: row.matchedMaterialId && row.matchedSpecId ? "" : "未匹配材料档案"
    };
  });
}

function isBomRelated(log: AuditLogRow, bom: ProjectBom) {
  const text = `${log.remark ?? ""} ${JSON.stringify(log.metadata ?? {})}`;
  return text.includes(bom.id) || text.includes(bom.drawingNo) || text.includes("BOM");
}

function purchaseBelongsToBom(request: PurchaseRequestRow, bom: ProjectBom) {
  const meta = parseJsonMeta(request.remark);
  return meta.bomId === bom.id || (bom.purchaseRequestIds ?? []).includes(request.id);
}

function buildArchive(projects: ProjectRow[], purchaseRequests: PurchaseRequestRow[], logs: AuditLogRow[], index: Awaited<ReturnType<typeof loadMaterialIndex>>) {
  const archive: { project: ProjectRow; drawings: ProjectDrawing[]; boms: BomArchiveItem[] }[] = [];
  const flattened: BomArchiveItem[] = [];

  for (const project of projects) {
    const notes = parseProjectNotes(project.notes);
    const boms = notes.boms.map((sourceBom) => {
      const bom = enrichBomMatch(sourceBom, index);
      const drawing = notes.drawings.find((item) => item.id === bom.drawingId || item.drawingNo === bom.drawingNo);
      const analysis = analyzeBom(bom, index.stock);
      const linkedPurchaseRequests = purchaseRequests.filter((item) => item.projectId === project.id && purchaseBelongsToBom(item, bom));
      const item: BomArchiveItem = {
        ...bom,
        projectName: project.name,
        projectCode: bom.projectCode || project.code,
        projectStatus: project.status,
        drawingName: drawing?.name ?? "",
        drawingVersion: drawing?.version ?? "",
        drawingRemark: drawing?.remark ?? "",
        drawingVoided: Boolean(drawing?.voided),
        detailCount: bom.rows.length,
        shortageCount: bom.voided ? 0 : analysis.filter((row) => row.shortageQty > 0).length,
        shortageQty: bom.voided ? 0 : analysis.reduce((sum, row) => sum + Number(row.shortageQty ?? 0), 0),
        analysis,
        linkedPurchaseRequests,
        logs: logs.filter((log) => log.projectId === project.id && isBomRelated(log, bom)).slice(0, 20)
      };
      flattened.push(item);
      return item;
    });
    archive.push({ project, drawings: notes.drawings, boms });
  }

  return { projects: archive, boms: flattened };
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ ok: false, error: "未登录或账号已禁用。" }, { status: 401 });
  if (!hasPermission(auth.profile.role, "bom")) return NextResponse.json({ ok: false, error: "当前角色无权访问 BOM 档案库。" }, { status: 403 });

  const supabase = createSupabaseAdminClient();
  const [{ data: projects, error: projectError }, { data: requests, error: requestError }, { data: logs, error: logError }, index] = await Promise.all([
    supabase.from("Project").select("id,name,code,status,notes,updatedAt").order("updatedAt", { ascending: false }),
    supabase.from("PurchaseRequest").select("id,requestNo,projectId,status,purpose,remark,createdAt").order("createdAt", { ascending: false }),
    supabase.from("AuditLog").select("id,actorId,action,projectId,remark,metadata,createdAt,actor:UserProfile(name)").order("createdAt", { ascending: false }).limit(500),
    loadMaterialIndex()
  ]);

  if (projectError) return NextResponse.json({ ok: false, error: projectError.message }, { status: 500 });
  if (requestError) return NextResponse.json({ ok: false, error: requestError.message }, { status: 500 });
  if (logError) return NextResponse.json({ ok: false, error: logError.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    ...buildArchive((projects as ProjectRow[] | null) ?? [], (requests as PurchaseRequestRow[] | null) ?? [], (logs as AuditLogRow[] | null) ?? [], index)
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ ok: false, error: "未登录或账号已禁用。" }, { status: 401 });
  if (!hasPermission(auth.profile.role, "bom")) return NextResponse.json({ ok: false, error: "当前角色无权操作 BOM 档案库。" }, { status: 403 });

  const body = (await request.json()) as { projectId?: string; bomId?: string; action?: "void" | "restore" | "generatePurchase"; reason?: string; confirmed?: boolean };
  if (!body.projectId || !body.bomId || !body.action) return NextResponse.json({ ok: false, error: "缺少项目、BOM 或操作类型。" }, { status: 400 });
  if (!body.confirmed) return NextResponse.json({ ok: false, error: "该操作必须二次确认。" }, { status: 400 });
  if ((body.action === "void" || body.action === "restore") && !isAdminOrBoss(auth.profile.role)) return NextResponse.json({ ok: false, error: "只有老板/管理员可以作废或恢复 BOM。" }, { status: 403 });
  if ((body.action === "void" || body.action === "restore" || body.action === "generatePurchase") && !body.reason?.trim()) return NextResponse.json({ ok: false, error: "请填写操作原因。" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: before, error: beforeError } = await supabase.from("Project").select("*").eq("id", body.projectId).maybeSingle();
  if (beforeError) return NextResponse.json({ ok: false, error: beforeError.message }, { status: 500 });
  if (!before) return NextResponse.json({ ok: false, error: "项目不存在。" }, { status: 404 });

  const notes = parseProjectNotes(before.notes);
  const bom = notes.boms.find((item) => item.id === body.bomId);
  if (!bom) return NextResponse.json({ ok: false, error: "BOM 不存在。" }, { status: 404 });
  const now = new Date().toISOString();

  if (body.action === "void" || body.action === "restore") {
    const nextBoms = notes.boms.map((item) => {
      if (item.id !== body.bomId) return item;
      return body.action === "void"
        ? { ...item, voided: true, voidReason: body.reason?.trim(), voidedAt: now, isCurrent: false }
        : { ...item, voided: false, voidReason: "", restoredAt: now };
    });
    const { data: after, error } = await supabase.from("Project").update({ notes: stringifyProjectNotes({ ...notes, boms: nextBoms }), updatedAt: now }).eq("id", body.projectId).select("*").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    await writeOperationLog({
      actorId: auth.profile.id,
      action: body.action === "void" ? "DELETE" : "UPDATE",
      projectId: body.projectId,
      remark: `${body.action === "void" ? "作废" : "恢复"} BOM：${bom.drawingNo} / ${bom.version}，原因：${body.reason}`,
      before: bom,
      after: nextBoms.find((item) => item.id === body.bomId),
      extra: { action: body.action === "void" ? "VOID_BOM" : "RESTORE_BOM", bomId: body.bomId },
      request
    });
    return NextResponse.json({ ok: true, message: body.action === "void" ? "BOM 已作废。" : "BOM 已恢复。", project: after });
  }

  if (bom.voided) return NextResponse.json({ ok: false, error: "已作废 BOM 不能生成采购申请。" }, { status: 400 });

  const index = await loadMaterialIndex();
  const enriched = enrichBomMatch(bom, index);
  const analysis = analyzeBom(enriched, index.stock);
  const shortageRows = analysis.filter((row) => row.shortageQty > 0 && row.matchedMaterialId && row.matchedSpecId);
  const skipped = analysis.filter((row) => row.shortageQty > 0 && (!row.matchedMaterialId || !row.matchedSpecId));
  if (shortageRows.length === 0) {
    return NextResponse.json({ ok: true, message: skipped.length ? "存在未匹配材料，请先创建材料档案。" : "当前 BOM 无缺料，无需生成采购申请。", skipped });
  }

  const created: PurchaseRequestRow[] = [];
  for (const row of shortageRows) {
    const requestId = compactId("pr");
    const { data: purchaseRequest, error } = await supabase.from("PurchaseRequest").insert({
      id: requestId,
      requestNo: docNo("PR"),
      projectId: body.projectId,
      applicantId: auth.profile.id,
      status: "PENDING_APPROVAL",
      purpose: `BOM档案缺料：${bom.drawingNo}`,
      remark: stringifyJsonMeta({ remark: `由 BOM 档案 ${bom.version} 自动生成`, drawingId: bom.drawingId, bomId: bom.id, reason: body.reason }),
      createdAt: now,
      updatedAt: now
    }).select("id,requestNo,projectId,status,purpose,remark,createdAt").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const { error: itemError } = await supabase.from("PurchaseRequestItem").insert({
      id: compactId("pri"),
      purchaseRequestId: requestId,
      materialId: row.matchedMaterialId,
      specId: row.matchedSpecId,
      quantity: row.shortageQty,
      unit: row.unit,
      purpose: `BOM档案缺料：${bom.drawingNo}`,
      remark: row.remark || null
    });
    if (itemError) return NextResponse.json({ ok: false, error: itemError.message }, { status: 500 });
    created.push(purchaseRequest as PurchaseRequestRow);
  }

  const nextBoms = notes.boms.map((item) => item.id === body.bomId ? { ...item, purchaseGeneratedAt: now, purchaseRequestIds: [...new Set([...(item.purchaseRequestIds ?? []), ...created.map((requestRow) => requestRow.id)])] } : item);
  const { data: after, error: updateError } = await supabase.from("Project").update({ notes: stringifyProjectNotes({ ...notes, boms: nextBoms }), updatedAt: now }).eq("id", body.projectId).select("*").single();
  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

  await writeOperationLog({
    actorId: auth.profile.id,
    action: "PURCHASE_REQUEST",
    projectId: body.projectId,
    remark: `BOM 档案缺料生成采购申请：${created.length} 条，原因：${body.reason}`,
    before: bom,
    after: { created, bom: nextBoms.find((item) => item.id === body.bomId) },
    extra: { action: "ARCHIVE_BOM_GENERATE_PURCHASE", bomId: body.bomId, skipped },
    request
  });

  return NextResponse.json({ ok: true, message: `已生成 ${created.length} 条采购申请。`, created, skipped, project: after });
}
