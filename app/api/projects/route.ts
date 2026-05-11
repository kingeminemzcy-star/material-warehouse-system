import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { canManageProjects, getAuthContext, type Role } from "@/lib/auth";
import { writeOperationLog } from "@/lib/audit";
import { parseProjectNotes, stringifyProjectNotes } from "@/lib/project-meta";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ProjectStatus = "PLANNING" | "ACTIVE" | "PAUSED" | "COMPLETED";

type ProjectRow = {
  id: string;
  code: string;
  name: string;
  customer: string | null;
  managerId: string | null;
  status: ProjectStatus;
  notes: string | null;
  createdAt: string;
};

type UserRow = {
  id: string;
  name: string;
  role: Role;
};

const statusLabels: Record<ProjectStatus, string> = {
  PLANNING: "待开工",
  ACTIVE: "进行中",
  PAUSED: "暂停",
  COMPLETED: "已完成"
};

function statusFromLabel(label: string): ProjectStatus {
  const map: Record<string, ProjectStatus> = {
    待开工: "PLANNING",
    备料中: "PLANNING",
    进行中: "ACTIVE",
    暂停: "PAUSED",
    已完成: "COMPLETED",
    PLANNING: "PLANNING",
    ACTIVE: "ACTIVE",
    PAUSED: "PAUSED",
    COMPLETED: "COMPLETED"
  };
  return map[label] ?? "ACTIVE";
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  let query = supabase.from("Project").select("id,code,name,customer,managerId,status,notes,createdAt").order("createdAt", { ascending: false });

  if (auth.profile.role === "PROJECT_MANAGER") {
    query = query.eq("managerId", auth.profile.id);
  }

  const [{ data: projects, error: projectError }, { data: managers, error: managerError }] = await Promise.all([
    query,
    supabase.from("UserProfile").select("id,name,role").in("role", ["ADMIN", "BOSS", "PROJECT_MANAGER"]).eq("isActive", true)
  ]);

  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 });
  if (managerError) return NextResponse.json({ error: managerError.message }, { status: 500 });

  const managerById = new Map((managers as UserRow[] | null ?? []).map((manager) => [manager.id, manager]));
  return NextResponse.json({
    managers,
    projects: ((projects ?? []) as ProjectRow[]).map((project) => {
      const notes = parseProjectNotes(project.notes);
      return {
        id: project.id,
        code: project.code,
        name: project.name,
        customer: project.customer ?? "",
        address: notes.address,
        remark: notes.remark,
        voided: notes.voided,
        voidReason: notes.voidReason,
        voidedAt: notes.voidedAt,
        drawingCount: notes.drawings.length,
        managerId: project.managerId,
        manager: project.managerId ? managerById.get(project.managerId)?.name ?? "-" : "-",
        status: project.status,
        statusText: notes.voided ? "已作废" : statusLabels[project.status]
      };
    })
  });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  if (!canManageProjects(auth.profile.role)) {
    return NextResponse.json({ error: "当前角色无权创建工程项目。" }, { status: 403 });
  }

  const body = (await request.json()) as {
    code?: string;
    name?: string;
    customer?: string;
    address?: string;
    managerId?: string;
    remark?: string;
    status?: string;
  };

  if (!body.code || !body.name) {
    return NextResponse.json({ error: "项目编号和项目名称必填。" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const managerId = auth.profile.role === "PROJECT_MANAGER" ? auth.profile.id : body.managerId || null;
  const { data: project, error } = await supabase
    .from("Project")
    .insert({
      id: `proj_${randomUUID().replace(/-/g, "")}`,
      code: body.code,
      name: body.name,
      customer: body.customer || null,
      managerId,
      status: statusFromLabel(body.status ?? "ACTIVE"),
      notes: stringifyProjectNotes({ address: body.address ?? "", remark: body.remark ?? "" }),
      createdAt: now,
      updatedAt: now
    })
    .select("id,code,name")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("AuditLog").insert({
    id: `log_${randomUUID().replace(/-/g, "")}`,
    actorId: auth.profile.id,
    action: "UPDATE",
    projectId: project.id,
    remark: `创建工程项目：${project.name}`,
    metadata: { action: "CREATE_PROJECT", projectCode: project.code },
    createdAt: now
  });

  return NextResponse.json({ message: "工程项目已创建。", project });
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  if (!canManageProjects(auth.profile.role)) {
    return NextResponse.json({ error: "当前角色无权修改工程项目。" }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    code?: string;
    name?: string;
    customer?: string;
    address?: string;
    managerId?: string;
    remark?: string;
    status?: string;
    reason?: string;
    action?: "complete";
    forceComplete?: boolean;
  };

  if (!body.id || !body.reason?.trim()) {
    return NextResponse.json({ error: "修改项目必须提供项目 ID 和修改原因。" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: before, error: beforeError } = await supabase.from("Project").select("*").eq("id", body.id).maybeSingle();
  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 500 });
  if (!before) return NextResponse.json({ error: "项目不存在。" }, { status: 404 });

  const oldNotes = parseProjectNotes(before.notes);
  if (oldNotes.voided) {
    return NextResponse.json({ error: "项目已作废，不能继续修改。" }, { status: 400 });
  }
  if (before.status === "COMPLETED" && body.action !== "complete") {
    return NextResponse.json({ error: "项目已完工，只读状态下不能修改。" }, { status: 400 });
  }

  if (body.action === "complete" && !body.forceComplete) {
    const [{ data: outbound }, { data: returns }] = await Promise.all([
      supabase.from("OutboundRecord").select("quantity").eq("projectId", body.id),
      supabase.from("InboundRecord").select("quantity").eq("projectId", body.id).eq("source", "PROJECT_RETURN")
    ]);
    const outboundQty = (outbound ?? []).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
    const returnQty = (returns ?? []).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
    const unreturnedQty = Math.max(0, outboundQty - returnQty);
    if (unreturnedQty > 0) {
      return NextResponse.json({
        error: `项目仍有未退料数量 ${unreturnedQty}，确认无剩余材料后可强制完工。`,
        code: "UNRETURNED_MATERIALS",
        unreturnedQty
      }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  const patch = {
    code: body.code ?? before.code,
    name: body.name ?? before.name,
    customer: body.customer ?? before.customer,
    managerId: body.managerId === undefined ? before.managerId : body.managerId || null,
    status: body.action === "complete" ? "COMPLETED" : statusFromLabel(body.status ?? before.status),
    notes: stringifyProjectNotes({
      address: body.address ?? oldNotes.address,
      remark: body.remark ?? oldNotes.remark,
      voided: oldNotes.voided,
      voidReason: oldNotes.voidReason,
      voidedAt: oldNotes.voidedAt,
      drawings: oldNotes.drawings,
      boms: oldNotes.boms
    }),
    updatedAt: now
  };

  const { data: after, error } = await supabase.from("Project").update(patch).eq("id", body.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeOperationLog({
    actorId: auth.profile.id,
    action: "UPDATE",
    projectId: body.id,
    remark: body.action === "complete" ? `项目完工：${body.reason}` : `管理员修改项目：${body.reason}`,
    before,
    after,
    extra: { entity: "project", recordId: body.id }
  });

  return NextResponse.json({ message: "项目已修改，并已写入操作日志。", project: after });
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  if (auth.profile.role !== "ADMIN" && auth.profile.role !== "BOSS") {
    return NextResponse.json({ error: "只有老板/管理员可以删除或作废项目。" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const reason = searchParams.get("reason");
  if (!id || !reason?.trim()) {
    return NextResponse.json({ error: "删除/作废项目必须提供项目 ID 和原因。" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: before, error: beforeError } = await supabase.from("Project").select("*").eq("id", id).maybeSingle();
  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 500 });
  if (!before) return NextResponse.json({ error: "项目不存在。" }, { status: 404 });

  const [{ count: requestCount }, { count: inboundCount }, { count: outboundCount }] = await Promise.all([
    supabase.from("PurchaseRequest").select("id", { count: "exact", head: true }).eq("projectId", id),
    supabase.from("InboundRecord").select("id", { count: "exact", head: true }).eq("projectId", id),
    supabase.from("OutboundRecord").select("id", { count: "exact", head: true }).eq("projectId", id)
  ]);

  const hasBusiness = Boolean((requestCount ?? 0) + (inboundCount ?? 0) + (outboundCount ?? 0));

  if (!hasBusiness) {
    const { error } = await supabase.from("Project").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await writeOperationLog({
      actorId: auth.profile.id,
      action: "DELETE",
      projectId: null,
      remark: `硬删除无业务关联项目：${reason}`,
      before,
      after: null,
      extra: { entity: "project", recordId: id, hardDelete: true }
    });
    return NextResponse.json({ message: "项目无业务关联，已删除。" });
  }

  const oldNotes = parseProjectNotes(before.notes);
  const now = new Date().toISOString();
  const patch = {
    status: "PAUSED",
    notes: stringifyProjectNotes({
      address: oldNotes.address,
      remark: oldNotes.remark,
      voided: true,
      voidReason: reason,
      voidedAt: now,
      drawings: oldNotes.drawings,
      boms: oldNotes.boms
    }),
    updatedAt: now
  };
  const { data: after, error } = await supabase.from("Project").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeOperationLog({
    actorId: auth.profile.id,
    action: "DELETE",
    projectId: id,
    remark: `作废已有业务关联项目：${reason}`,
    before,
    after,
    extra: { entity: "project", recordId: id, hardDelete: false, voided: true }
  });

  return NextResponse.json({ message: "项目已有业务记录，已按规则作废。" });
}
