import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { writeOperationLog } from "@/lib/audit";
import { compactId, docNo } from "@/lib/ids";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { purchaseStatusLabels } from "@/lib/warehouse-maps";

type PurchaseOrderMeta = {
  remark?: string;
  purchaseCompleted?: boolean;
  purchaseCompletedBy?: string;
  purchaseCompletedAt?: string;
  purchaseCompletedRemark?: string;
  acceptanceStatus?: "NONE" | "PENDING" | "ACCEPTED" | "REJECTED";
  acceptedBy?: string;
  acceptedAt?: string;
  acceptanceRemark?: string;
  lastReminderAt?: string;
  lastReminderBy?: string;
  reminderRemark?: string;
};

type OrderItemQty = { quantity: string | number; receivedQty: string | number };

function parseMeta(remark: string | null): PurchaseOrderMeta {
  if (!remark) return { acceptanceStatus: "NONE" };
  try {
    return { acceptanceStatus: "NONE", ...(JSON.parse(remark) as PurchaseOrderMeta) };
  } catch {
    return { remark, acceptanceStatus: "NONE" };
  }
}

function stringifyMeta(meta: PurchaseOrderMeta) {
  return JSON.stringify(meta);
}

function deriveStatus(row: {
  status: string;
  remark: string | null;
  PurchaseOrderItem?: OrderItemQty[];
}) {
  const meta = parseMeta(row.remark);
  const items = row.PurchaseOrderItem ?? [];
  const total = items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
  const received = items.reduce((sum, item) => sum + Number(item.receivedQty ?? 0), 0);

  if (total > 0 && received >= total) return "已全部入库";
  if (received > 0) return "部分到货";
  if (meta.acceptanceStatus === "ACCEPTED") return "待入库";
  if (meta.acceptanceStatus === "PENDING") return "待到货验收";
  if (meta.purchaseCompleted) return "已采购完成";
  if (row.status === "ORDERED") return "采购中";
  return purchaseStatusLabels[row.status as keyof typeof purchaseStatusLabels] ?? row.status;
}

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const [{ data: orders, error }, { data: approved }] = await Promise.all([
    supabase.from("PurchaseOrder").select("*, PurchaseRequest(requestNo), UserProfile!PurchaseOrder_purchaserId_fkey(name), PurchaseOrderItem(quantity,receivedQty)").order("orderedAt", { ascending: false }),
    supabase.from("PurchaseRequest").select("id,requestNo,status").eq("status", "APPROVED")
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    approvedRequests: approved ?? [],
    orders: (orders ?? []).map((row) => {
      const meta = parseMeta(row.remark);
      return {
        id: row.id,
        orderNo: row.orderNo,
        requestNo: row.PurchaseRequest?.requestNo ?? "-",
        supplier: row.supplier,
        purchaser: row.UserProfile?.name ?? "-",
        amount: Number(row.totalAmount ?? 0),
        expectedArrival: row.expectedArrival?.slice(0, 10) ?? "-",
        status: row.status,
        statusText: deriveStatus(row),
        meta,
        receivedQty: ((row.PurchaseOrderItem ?? []) as OrderItemQty[]).reduce((sum: number, item: OrderItemQty) => sum + Number(item.receivedQty ?? 0), 0),
        orderedQty: ((row.PurchaseOrderItem ?? []) as OrderItemQty[]).reduce((sum: number, item: OrderItemQty) => sum + Number(item.quantity ?? 0), 0)
      };
    })
  });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  if (auth.profile.role !== "ADMIN" && auth.profile.role !== "BOSS" && auth.profile.role !== "PURCHASER") {
    return NextResponse.json({ error: "只有采购员或管理员可以创建采购单。" }, { status: 403 });
  }
  const body = (await request.json()) as { purchaseRequestId?: string; supplier?: string; totalAmount?: number; expectedArrival?: string; remark?: string };
  if (!body.purchaseRequestId || !body.supplier) return NextResponse.json({ error: "已审批申请和供应商必填。" }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data: requestRow } = await supabase.from("PurchaseRequest").select("id,status").eq("id", body.purchaseRequestId).maybeSingle();
  if (!requestRow || requestRow.status !== "APPROVED") return NextResponse.json({ error: "只能由已审批申请生成采购单。" }, { status: 400 });

  const now = new Date().toISOString();
  const orderId = compactId("po");
  const { data: order, error } = await supabase.from("PurchaseOrder").insert({
    id: orderId,
    orderNo: docNo("PO"),
    purchaseRequestId: body.purchaseRequestId,
    purchaserId: auth.profile.id,
    supplier: body.supplier,
    totalAmount: body.totalAmount ?? 0,
    expectedArrival: body.expectedArrival ? new Date(body.expectedArrival).toISOString() : null,
    status: "ORDERED",
    remark: stringifyMeta({ remark: body.remark || "", acceptanceStatus: "NONE" }),
    orderedAt: now,
    updatedAt: now
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: items } = await supabase.from("PurchaseRequestItem").select("*").eq("purchaseRequestId", body.purchaseRequestId);
  if (items?.length) {
    await supabase.from("PurchaseOrderItem").insert(items.map((item) => ({
      id: compactId("poi"),
      purchaseOrderId: orderId,
      materialId: item.materialId,
      specId: item.specId,
      quantity: item.quantity,
      receivedQty: 0,
      unitPrice: 0,
      unit: item.unit
    })));
  }
  await supabase.from("PurchaseRequest").update({ status: "ORDERED", updatedAt: now }).eq("id", body.purchaseRequestId);
  await writeOperationLog({ actorId: auth.profile.id, action: "PURCHASE_ORDER", remark: "采购下单", before: requestRow, after: order });
  return NextResponse.json({ message: "采购单已创建。", order });
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  if (auth.profile.role !== "ADMIN" && auth.profile.role !== "BOSS" && auth.profile.role !== "PURCHASER" && auth.profile.role !== "WAREHOUSE") {
    return NextResponse.json({ error: "无采购流程操作权限。" }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    action?: "completePurchase" | "acceptArrival" | "rejectArrival" | "remind";
    remark?: string;
  };
  if (!body.id || !body.action) return NextResponse.json({ error: "缺少采购单 ID 或操作类型。" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: before, error: beforeError } = await supabase
    .from("PurchaseOrder")
    .select("*, PurchaseOrderItem(quantity,receivedQty)")
    .eq("id", body.id)
    .maybeSingle();
  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 500 });
  if (!before) return NextResponse.json({ error: "采购单不存在。" }, { status: 404 });

  const meta = parseMeta(before.remark);
  const now = new Date().toISOString();
  let message = "";
  const nextStatus = before.status;

  if (body.action === "completePurchase") {
    meta.purchaseCompleted = true;
    meta.purchaseCompletedBy = auth.profile.id;
    meta.purchaseCompletedAt = now;
    meta.purchaseCompletedRemark = body.remark || "";
    meta.acceptanceStatus = "PENDING";
    message = "采购完成已确认，状态进入待到货验收。";
  }

  if (body.action === "acceptArrival") {
    if (!meta.purchaseCompleted) return NextResponse.json({ error: "需先确认采购完成，才能到货验收。" }, { status: 400 });
    meta.acceptanceStatus = "ACCEPTED";
    meta.acceptedBy = auth.profile.id;
    meta.acceptedAt = now;
    meta.acceptanceRemark = body.remark || "";
    message = "到货验收已通过，现在可以入库。";
  }

  if (body.action === "rejectArrival") {
    if (!meta.purchaseCompleted) return NextResponse.json({ error: "需先确认采购完成，才能验收拒绝。" }, { status: 400 });
    meta.acceptanceStatus = "REJECTED";
    meta.acceptedBy = auth.profile.id;
    meta.acceptedAt = now;
    meta.acceptanceRemark = body.remark || "";
    message = "到货验收已拒绝。";
  }

  if (body.action === "remind") {
    meta.lastReminderAt = now;
    meta.lastReminderBy = auth.profile.id;
    meta.reminderRemark = body.remark || "催货提醒";
    message = "催货提醒已记录。";
  }

  const { data: after, error } = await supabase
    .from("PurchaseOrder")
    .update({ status: nextStatus, remark: stringifyMeta(meta), updatedAt: now })
    .eq("id", body.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeOperationLog({
    actorId: auth.profile.id,
    action: "PURCHASE_ORDER",
    remark: `${message}${body.remark ? ` 备注：${body.remark}` : ""}`,
    before,
    after,
    extra: { purchaseOrderId: body.id, purchaseFlowAction: body.action }
  });

  return NextResponse.json({ message, order: after });
}
