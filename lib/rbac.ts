import { NextResponse } from "next/server";
import type { Role } from "@/lib/auth";

export const permissions = {
  dashboard: ["ADMIN", "BOSS", "PROJECT_MANAGER", "PURCHASER", "WAREHOUSE"],
  projects: ["ADMIN", "BOSS", "PROJECT_MANAGER"],
  bom: ["ADMIN", "BOSS", "PROJECT_MANAGER", "PURCHASER"],
  materials: ["ADMIN", "BOSS", "PURCHASER", "WAREHOUSE", "PROJECT_MANAGER"],
  purchaseRequests: ["ADMIN", "BOSS", "PROJECT_MANAGER"],
  approvals: ["ADMIN", "BOSS"],
  purchaseOrders: ["ADMIN", "BOSS", "PURCHASER"],
  inbound: ["ADMIN", "BOSS", "WAREHOUSE"],
  outbound: ["ADMIN", "BOSS", "WAREHOUSE", "PROJECT_MANAGER"],
  inventory: ["ADMIN", "BOSS", "WAREHOUSE", "PURCHASER", "PROJECT_MANAGER"],
  logs: ["ADMIN", "BOSS"],
  accounts: ["ADMIN", "BOSS"],
  suppliers: ["ADMIN", "BOSS", "PURCHASER"],
  units: ["ADMIN", "BOSS"],
  photos: ["ADMIN", "BOSS", "WAREHOUSE", "PROJECT_MANAGER"]
} satisfies Record<string, Role[]>;

export type PermissionKey = keyof typeof permissions;

export function hasPermission(role: Role, permission: PermissionKey) {
  return (permissions[permission] as Role[]).includes(role);
}

export function requirePermission(role: Role, permission: PermissionKey) {
  if (!hasPermission(role, permission)) {
    return NextResponse.json({ error: "当前角色无权执行此操作。" }, { status: 403 });
  }
  return null;
}

export function isAdminOrBoss(role: Role) {
  return role === "ADMIN" || role === "BOSS";
}

export function requireReason(reason: string | null | undefined, label = "危险操作") {
  if (!reason?.trim()) {
    return NextResponse.json({ error: `${label}必须填写操作原因。` }, { status: 400 });
  }
  return null;
}

export function requireConfirmation(confirmed: boolean | undefined, label = "危险操作") {
  if (!confirmed) {
    return NextResponse.json({ error: `${label}必须二次确认。` }, { status: 400 });
  }
  return null;
}
