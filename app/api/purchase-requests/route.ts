import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { writeOperationLog } from "@/lib/audit";
import { compactId, docNo } from "@/lib/ids";
import { parseJsonMeta, stringifyJsonMeta } from "@/lib/json-meta";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { purchaseStatusLabels } from "@/lib/warehouse-maps";

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("PurchaseRequest")
    .select("*, Project(name), UserProfile!PurchaseRequest_applicantId_fkey(name), PurchaseRequestItem(*, Material(name), MaterialSpec(specModel,materialText,dimensionsText))")
    .order("createdAt", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    requests: (data ?? []).map((row) => {
      const item = row.PurchaseRequestItem?.[0];
      return {
        id: row.id,
        requestNo: row.requestNo,
        project: row.Project?.name ?? "-",
        applicant: row.UserProfile?.name ?? "-",
        material: item ? `${item.Material?.name ?? ""} ${item.MaterialSpec?.materialText ?? ""} ${item.MaterialSpec?.specModel ?? ""} ${item.MaterialSpec?.dimensionsText ?? ""}` : "-",
        quantity: item ? `${item.quantity} ${item.unit}` : "-",
        purpose: item?.purpose ?? row.purpose,
        drawingId: parseJsonMeta(row.remark).drawingId ?? "",
        expected: row.expectedArrival?.slice(0, 10) ?? "-",
        status: row.status,
        statusText: purchaseStatusLabels[row.status as keyof typeof purchaseStatusLabels]
      };
    })
  });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });

  const body = (await request.json()) as {
    projectId?: string;
    materialId?: string;
    specId?: string;
    quantity?: number;
    unit?: string;
    purpose?: string;
    expectedArrival?: string;
    remark?: string;
    drawingId?: string;
  };
  if (!body.projectId || !body.materialId || !body.specId || !body.quantity || !body.unit || !body.purpose) {
    return NextResponse.json({ error: "工程、材料、数量、单位、用途必填。" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const requestId = compactId("pr");
  const { data: purchaseRequest, error } = await supabase
    .from("PurchaseRequest")
    .insert({
      id: requestId,
      requestNo: docNo("PR"),
      projectId: body.projectId,
      applicantId: auth.profile.id,
      status: "PENDING_APPROVAL",
      purpose: body.purpose,
      expectedArrival: body.expectedArrival ? new Date(body.expectedArrival).toISOString() : null,
      remark: stringifyJsonMeta({ remark: body.remark || "", drawingId: body.drawingId || "" }),
      createdAt: now,
      updatedAt: now
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: itemError } = await supabase.from("PurchaseRequestItem").insert({
    id: compactId("pri"),
    purchaseRequestId: requestId,
    materialId: body.materialId,
    specId: body.specId,
    quantity: body.quantity,
    unit: body.unit,
    purpose: body.purpose,
    remark: body.remark || null
  });
  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });

  await writeOperationLog({
    actorId: auth.profile.id,
    action: "PURCHASE_REQUEST",
    materialId: body.materialId,
    projectId: body.projectId,
    remark: "提交采购申请",
    before: null,
    after: purchaseRequest
  });

  return NextResponse.json({ message: "采购申请已提交，状态为待审批。", request: purchaseRequest });
}
