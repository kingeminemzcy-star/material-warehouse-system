import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { canManageAccounts, getAuthContext, roleFromLabel, roleLabels, type Role } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type UserProfileRow = {
  id: string;
  supabaseUserId: string;
  name: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
};

async function assertAdmin(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return { error: NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 }) };
  }
  if (!canManageAccounts(auth.profile.role)) {
    return { error: NextResponse.json({ error: "只有老板/管理员可以管理账号。" }, { status: 403 }) };
  }
  return { auth };
}

export async function GET(request: NextRequest) {
  const checked = await assertAdmin(request);
  if (checked.error) return checked.error;

  const supabase = createSupabaseAdminClient();
  const [{ data: profiles, error: profileError }, { data: authUsers, error: authError }] = await Promise.all([
    supabase.from("UserProfile").select("id,supabaseUserId,name,phone,role,isActive,createdAt").order("createdAt", { ascending: false }),
    supabase.auth.admin.listUsers()
  ]);

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  const emailById = new Map(authUsers.users.map((user) => [user.id, user.email ?? ""]));
  return NextResponse.json({
    users: ((profiles ?? []) as UserProfileRow[]).map((profile) => ({
      id: profile.id,
      supabaseUserId: profile.supabaseUserId,
      name: profile.name,
      phone: profile.phone,
      email: emailById.get(profile.supabaseUserId) ?? "",
      role: profile.role,
      roleLabel: roleLabels[profile.role],
      isActive: profile.isActive,
      createdAt: profile.createdAt
    }))
  });
}

export async function POST(request: NextRequest) {
  const checked = await assertAdmin(request);
  if (checked.error) return checked.error;

  const body = (await request.json()) as {
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    role?: string;
    isActive?: boolean;
  };

  if (!body.name || !body.email || !body.password || !body.role) {
    return NextResponse.json({ error: "姓名、邮箱、密码、角色必填。" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const role = roleFromLabel(body.role);
  const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { name: body.name, role }
  });

  if (createError || !authUser.user) {
    return NextResponse.json({ error: createError?.message ?? "账号创建失败。" }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { error: profileError } = await supabase.from("UserProfile").insert({
    id: `usr_${authUser.user.id.replace(/-/g, "")}`,
    supabaseUserId: authUser.user.id,
    name: body.name,
    phone: body.phone || null,
    role,
    isActive: body.isActive ?? true,
    createdAt: now,
    updatedAt: now
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  await supabase.from("AuditLog").insert({
    id: `log_${randomUUID().replace(/-/g, "")}`,
    actorId: checked.auth.profile.id,
    action: "UPDATE",
    remark: `创建账号：${body.name}（${roleLabels[role]}）`,
    metadata: { targetUserId: authUser.user.id, action: "CREATE_ACCOUNT" },
    createdAt: now
  });

  return NextResponse.json({ message: "账号已创建。" });
}

export async function PATCH(request: NextRequest) {
  const checked = await assertAdmin(request);
  if (checked.error) return checked.error;

  const body = (await request.json()) as {
    supabaseUserId?: string;
    name?: string;
    phone?: string;
    role?: string;
    isActive?: boolean;
    password?: string;
  };

  if (!body.supabaseUserId) {
    return NextResponse.json({ error: "缺少账号 ID。" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const patch: Record<string, string | boolean | null> = { updatedAt: new Date().toISOString() };
  if (body.name !== undefined) patch.name = body.name;
  if (body.phone !== undefined) patch.phone = body.phone || null;
  if (body.role !== undefined) patch.role = roleFromLabel(body.role);
  if (body.isActive !== undefined) patch.isActive = body.isActive;

  const { error: profileError } = await supabase
    .from("UserProfile")
    .update(patch)
    .eq("supabaseUserId", body.supabaseUserId);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (body.password) {
    const { error: passwordError } = await supabase.auth.admin.updateUserById(body.supabaseUserId, {
      password: body.password
    });
    if (passwordError) {
      return NextResponse.json({ error: passwordError.message }, { status: 500 });
    }
  }

  await supabase.from("AuditLog").insert({
    id: `log_${randomUUID().replace(/-/g, "")}`,
    actorId: checked.auth.profile.id,
    action: "UPDATE",
    remark: "修改账号资料/状态/密码",
    metadata: { targetUserId: body.supabaseUserId, action: "UPDATE_ACCOUNT" },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({ message: "账号已更新。" });
}
