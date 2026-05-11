import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, roleLabels, type Role } from "@/lib/auth";
import { permissions } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: auth.profile.id,
      name: auth.profile.name,
      phone: auth.profile.phone,
      role: auth.profile.role,
      roleLabel: roleLabels[auth.profile.role],
      email: auth.email,
      isActive: auth.profile.isActive,
      permissions: Object.fromEntries(Object.entries(permissions).map(([key, roles]) => [key, (roles as Role[]).includes(auth.profile.role)]))
    }
  });
}
