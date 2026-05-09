import { randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function writeOperationLog({
  actorId,
  action,
  materialId,
  projectId,
  remark,
  before,
  after,
  extra
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
      ...extra
    },
    createdAt: new Date().toISOString()
  });
}
