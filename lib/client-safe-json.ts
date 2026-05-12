export type SafeJsonResult = Record<string, unknown> | null;

export async function safeJson(response: Response): Promise<SafeJsonResult> {
  const text = await response.text();
  if (!text.trim()) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { error: text };
  }
  try {
    return JSON.parse(text) as SafeJsonResult;
  } catch {
    return { error: text || "响应内容不是有效 JSON。" };
  }
}

export function responseError(payload: SafeJsonResult, fallback: string) {
  if (!payload) return fallback;
  const error = payload.error;
  return typeof error === "string" && error.trim() ? error : fallback;
}

export function responseMessage(payload: SafeJsonResult, fallback: string) {
  if (!payload) return fallback;
  const message = payload.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}
