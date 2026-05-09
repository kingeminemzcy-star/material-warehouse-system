export type JsonRecord = Record<string, unknown>;

export function parseJsonMeta(value: string | null | undefined): JsonRecord {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as JsonRecord) : { text: value };
  } catch {
    return { text: value };
  }
}

export function stringifyJsonMeta(meta: JsonRecord) {
  return JSON.stringify(meta);
}

export function textRemark(value: string | null | undefined) {
  const meta = parseJsonMeta(value);
  return String(meta.remark ?? meta.text ?? "");
}
