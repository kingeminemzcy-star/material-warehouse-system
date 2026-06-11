import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, roleLabels } from "@/lib/auth";
import { APP_VERSION } from "@/lib/version";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type CheckStatus = "normal" | "slow" | "down";

function elapsed(startedAt: number) {
  return Date.now() - startedAt;
}

function envStatus() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    ok: Boolean(supabaseUrl && anonKey && serviceRoleKey),
    supabaseUrlConfigured: Boolean(supabaseUrl),
    anonKeyConfigured: Boolean(anonKey),
    serviceRoleConfigured: Boolean(serviceRoleKey)
  };
}

function overallStatus(databaseOk: boolean, responseTimeMs: number): CheckStatus {
  if (!databaseOk) return "down";
  if (responseTimeMs > 2500) return "slow";
  return "normal";
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const env = envStatus();
  let database = {
    ok: false,
    status: "down" as CheckStatus,
    responseTimeMs: 0,
    error: ""
  };
  let auth = {
    ok: false,
    userName: "",
    role: "",
    roleLabel: "",
    error: ""
  };

  try {
    const dbStartedAt = Date.now();
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("Project").select("id", { count: "exact", head: true });
    const dbMs = elapsed(dbStartedAt);
    database = {
      ok: !error,
      status: error ? "down" : dbMs > 2500 ? "slow" : "normal",
      responseTimeMs: dbMs,
      error: error?.message ?? ""
    };
  } catch (error) {
    database = {
      ok: false,
      status: "down",
      responseTimeMs: elapsed(startedAt),
      error: error instanceof Error ? error.message : "数据库连接失败"
    };
  }

  try {
    const current = await getAuthContext(request);
    if (current) {
      auth = {
        ok: true,
        userName: current.profile.name,
        role: current.profile.role,
        roleLabel: roleLabels[current.profile.role],
        error: ""
      };
    } else {
      auth = { ...auth, error: "未登录或账号已禁用。" };
    }
  } catch (error) {
    auth = {
      ok: false,
      userName: "",
      role: "",
      roleLabel: "",
      error: error instanceof Error ? error.message : "认证服务连接失败"
    };
  }

  const responseTimeMs = elapsed(startedAt);
  const status = overallStatus(database.ok, responseTimeMs);
  const message = status === "down"
    ? "数据库服务暂不可用，请检查 Supabase 项目是否暂停"
    : status === "slow"
      ? "系统可用，但 Supabase 或数据库响应较慢"
      : "系统正常";

  return NextResponse.json({
    ok: database.ok,
    status,
    message,
    version: APP_VERSION,
    api: {
      ok: true,
      status: responseTimeMs > 2500 ? "slow" : "normal",
      responseTimeMs
    },
    supabase: {
      ok: env.ok && database.ok,
      configured: env,
      status: database.status,
      message: env.ok ? (database.ok ? "Supabase 配置可读取，服务可连接。" : message) : "Supabase 环境变量不完整。"
    },
    database,
    auth,
    checkedAt: new Date().toISOString()
  });
}
