import { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type Role = "ADMIN" | "BOSS" | "WAREHOUSE" | "PURCHASER" | "PROJECT_MANAGER";

export type AuthContext = {
  profile: {
    id: string;
    supabaseUserId: string;
    name: string;
    phone: string | null;
    role: Role;
    isActive: boolean;
  };
  email: string | null;
};

export const roleLabels: Record<Role, string> = {
  ADMIN: "老板/管理员",
  BOSS: "老板/管理员",
  WAREHOUSE: "仓库员",
  PURCHASER: "采购员",
  PROJECT_MANAGER: "项目经理"
};

export function roleFromLabel(label: string): Role {
  const map: Record<string, Role> = {
    "老板/管理员": "ADMIN",
    管理员: "ADMIN",
    老板: "BOSS",
    仓库员: "WAREHOUSE",
    采购员: "PURCHASER",
    项目经理: "PROJECT_MANAGER",
    ADMIN: "ADMIN",
    BOSS: "BOSS",
    WAREHOUSE: "WAREHOUSE",
    PURCHASER: "PURCHASER",
    PROJECT_MANAGER: "PROJECT_MANAGER"
  };
  return map[label] ?? "WAREHOUSE";
}

export function canManageAccounts(role: Role) {
  return role === "ADMIN" || role === "BOSS";
}

export function canApprove(role: Role) {
  return role === "ADMIN" || role === "BOSS";
}

export function canManageProjects(role: Role) {
  return role === "ADMIN" || role === "BOSS" || role === "PROJECT_MANAGER";
}

export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabase = createSupabaseAdminClient();

  if (token) {
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return null;

    const { data: profile } = await supabase
      .from("UserProfile")
      .select("id,supabaseUserId,name,phone,role,isActive")
      .eq("supabaseUserId", userData.user.id)
      .maybeSingle();

    if (!profile?.isActive) return null;
    return {
      profile: profile as AuthContext["profile"],
      email: userData.user.email ?? null
    };
  }

  const { data: fallback } = await supabase
    .from("UserProfile")
    .select("id,supabaseUserId,name,phone,role,isActive")
    .in("role", ["ADMIN", "BOSS"])
    .eq("isActive", true)
    .limit(1)
    .maybeSingle();

  if (!fallback) return null;

  return {
    profile: fallback as AuthContext["profile"],
    email: null
  };
}
