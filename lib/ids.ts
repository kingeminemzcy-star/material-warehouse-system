import { randomUUID } from "crypto";

export function compactId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

export function docNo(prefix: string) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${prefix}-${stamp}-${Math.floor(Math.random() * 900 + 100)}`;
}
