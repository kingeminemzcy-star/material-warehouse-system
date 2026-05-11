import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export function getRequestIp(request?: NextRequest) {
  if (!request) return null;
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || request.headers.get("cf-connecting-ip")
    || null;
}

export async function writeOperationLog({
  actorId,
  action,
  materialId,
  projectId,
  remark,
  before,
  after,
  extra,
  request
}: {
  actorId: string;
  action:
    | "PURCHASE_REQUEST"
    | "APPROVAL"
    | "PURCHASE_ORDER"
    | "INBOUND"
    | "OUTBOUND"
    | "UPDATE"
    | "DELETE"
    | "STOCK_ADJUSTMENT"
    | "LOGIN";
  materialId?: string | null;
  projectId?: string | null;
  remark: string;
  before?: unknown;
  after?: unknown;
  extra?: Record<string, unknown>;
  request?: NextRequest;
}) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("AuditLog").insert({
    id: `log_${randomUUID().replace(/-/g, "")}`,
    actorId,
    action,
    materialId: materialId ?? null,
    projectId: projectId ?? null,
    remark,
    metadata: {
      before,
      after,
      actorId,
      operatedAt: new Date().toISOString(),
      ip: getRequestIp(request),
      ...extra
    },
    createdAt: new Date().toISOString()
  });
}
