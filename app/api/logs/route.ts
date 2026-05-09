import { NextRequest, NextResponse } from "next/server";
import { canManageAccounts, getAuthContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("AuditLog")
    .select("*, UserProfile(name), Material(name), Project(name)")
    .order("createdAt", { ascending: false })
    .limit(200);
  if (!canManageAccounts(auth.profile.role)) query = query.eq("actorId", auth.profile.id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    logs: (data ?? []).map((row) => ({
      id: row.id,
      actor: row.UserProfile?.name ?? "-",
      action: row.action,
      material: row.Material?.name ?? "-",
      project: row.Project?.name ?? "-",
      remark: row.remark ?? "",
      metadata: row.metadata,
      createdAt: row.createdAt
    }))
  });
}
