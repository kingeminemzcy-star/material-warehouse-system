import { NextRequest, NextResponse } from "next/server";
import { canApprove, getAuthContext } from "@/lib/auth";
import { getRequestIp } from "@/lib/audit";
import { compactId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type PurchaseStatus = "PENDING_APPROVAL" | "REJECTED" | "APPROVED" | "ORDERED" | "PARTIAL_RECEIVED" | "COMPLETED";

type PurchaseRequestRow = {
  id: string;
  requestNo: string;
  projectId: string;
  applicantId: string;
  approverId: string | null;
  status: PurchaseStatus;
  purpose: string;
  expectedArrival: string | null;
  remark: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
};

type ProjectRow = {
  id: string;
  name: string;
};

type UserRow = {
  id: string;
  name: string;
  role: string;
};

type RequestItemRow = {
  id: string;
  purchaseRequestId: string;
  materialId: string;
  specId: string;
  quantity: string | number;
  unit: string;
  purpose: string | null;
};

type MaterialRow = {
  id: string;
  name: string;
};

type SpecRow = {
  id: string;
  specModel: string | null;
  materialText: string | null;
  dimensionsText: string | null;
};

function mapStatus(status: PurchaseStatus) {
  const statusMap: Record<PurchaseStatus, string> = {
    PENDING_APPROVAL: "待审批",
    REJECTED: "已拒绝",
    APPROVED: "已审批",
    ORDERED: "已下单",
    PARTIAL_RECEIVED: "部分到货",
    COMPLETED: "已完成"
  };
  return statusMap[status];
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])];
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: requests, error: requestError } = await supabase
    .from("PurchaseRequest")
    .select("*")
    .order("createdAt", { ascending: false });

  if (requestError) {
    return NextResponse.json({ error: requestError.message }, { status: 500 });
  }

  const rows = (requests ?? []) as PurchaseRequestRow[];
  if (rows.length === 0) {
    return NextResponse.json({ requests: [] });
  }

  const projectIds = unique(rows.map((row) => row.projectId));
  const userIds = unique(rows.flatMap((row) => [row.applicantId, row.approverId]));
  const requestIds = rows.map((row) => row.id);

  const [{ data: projects }, { data: users }, { data: items }] = await Promise.all([
    supabase.from("Project").select("id,name").in("id", projectIds),
    supabase.from("UserProfile").select("id,name,role").in("id", userIds),
    supabase.from("PurchaseRequestItem").select("*").in("purchaseRequestId", requestIds)
  ]);

  const itemRows = (items ?? []) as RequestItemRow[];
  const materialIds = unique(itemRows.map((item) => item.materialId));
  const specIds = unique(itemRows.map((item) => item.specId));

  const [{ data: materials }, { data: specs }] = await Promise.all([
    materialIds.length > 0
      ? supabase.from("Material").select("id,name").in("id", materialIds)
      : Promise.resolve({ data: [] }),
    specIds.length > 0
      ? supabase.from("MaterialSpec").select("id,specModel,materialText,dimensionsText").in("id", specIds)
      : Promise.resolve({ data: [] })
  ]);

  const projectById = new Map((projects as ProjectRow[] | null ?? []).map((project) => [project.id, project]));
  const userById = new Map((users as UserRow[] | null ?? []).map((user) => [user.id, user]));
  const materialById = new Map((materials as MaterialRow[] | null ?? []).map((material) => [material.id, material]));
  const specById = new Map((specs as SpecRow[] | null ?? []).map((spec) => [spec.id, spec]));

  const itemsByRequest = new Map<string, RequestItemRow[]>();
  for (const item of itemRows) {
    itemsByRequest.set(item.purchaseRequestId, [...(itemsByRequest.get(item.purchaseRequestId) ?? []), item]);
  }

  return NextResponse.json({
    requests: rows.map((row) => {
      const firstItem = itemsByRequest.get(row.id)?.[0];
      const material = firstItem ? materialById.get(firstItem.materialId) : null;
      const spec = firstItem ? specById.get(firstItem.specId) : null;
      const specText = [spec?.materialText, spec?.specModel, spec?.dimensionsText].filter(Boolean).join(" ");

      return {
        id: row.id,
        requestNo: row.requestNo,
        project: projectById.get(row.projectId)?.name ?? "-",
        applicant: userById.get(row.applicantId)?.name ?? "-",
        material: [material?.name, specText].filter(Boolean).join(" ") || "-",
        quantity: firstItem ? `${firstItem.quantity} ${firstItem.unit}` : "-",
        purpose: firstItem?.purpose ?? row.purpose,
        expected: row.expectedArrival ? row.expectedArrival.slice(0, 10) : "-",
        status: row.status,
        statusText: mapStatus(row.status),
        rejectedReason: row.rejectedReason
      };
    })
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  }
  if (!canApprove(auth.profile.role)) {
    return NextResponse.json({ error: "只有老板/管理员可以审批采购申请。" }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    action?: "approve" | "reject";
    reason?: string;
    confirmed?: boolean;
  };

  if (!body.id || !body.action) {
    return NextResponse.json({ error: "缺少审批单 ID 或审批动作。" }, { status: 400 });
  }

  if (body.action === "reject" && !body.reason?.trim()) {
    return NextResponse.json({ error: "拒绝审批必须填写原因。" }, { status: 400 });
  }
  if (!body.confirmed) {
    return NextResponse.json({ error: "审批操作必须二次确认。" }, { status: 400 });
  }

  const nextStatus: PurchaseStatus = body.action === "approve" ? "APPROVED" : "REJECTED";
  const now = new Date().toISOString();

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
    const current = await tx.purchaseRequest.findUnique({ where: { id: body.id } });
    if (!current) throw new Error("NOT_FOUND");
    if (current.status !== "PENDING_APPROVAL") throw new Error("ALREADY_APPROVED");
    const updated = await tx.purchaseRequest.update({
      where: { id: body.id },
      data: {
        status: nextStatus,
        approverId: auth.profile.id,
        approvedAt: body.action === "approve" ? new Date(now) : null,
        rejectedReason: body.action === "reject" ? body.reason || "老板审批拒绝" : null,
        updatedAt: new Date(now)
      }
    });
    await tx.auditLog.create({
      data: {
        id: compactId("log"),
        actorId: auth.profile.id,
        action: "APPROVAL",
        projectId: current.projectId,
        remark: body.action === "approve" ? "老板审批同意" : `老板审批拒绝：${body.reason || "未填写原因"}`,
        metadata: {
          before: current,
          after: updated,
          actorId: auth.profile.id,
          operatedAt: now,
          ip: getRequestIp(request),
          purchaseRequestId: body.id,
          requestNo: updated.requestNo,
          fromStatus: current.status,
          toStatus: nextStatus
        }
      }
    });
      return updated;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "采购申请不存在。" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "ALREADY_APPROVED") {
      return NextResponse.json({ error: "只有待审批的采购申请可以审批，禁止重复审批。" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({
    request: {
      id: result.id,
      requestNo: result.requestNo,
      status: result.status,
      statusText: mapStatus(result.status as PurchaseStatus)
    },
    message: body.action === "approve" ? "审批已同意，状态已更新为 APPROVED。" : "审批已拒绝，状态已更新为 REJECTED。"
  });
}
