import { parseJsonMeta, stringifyJsonMeta } from "@/lib/json-meta";

export type ProjectDrawing = {
  id: string;
  drawingNo: string;
  name: string;
  version: string;
  remark: string;
  createdAt: string;
};

export type ProjectNotes = {
  address: string;
  remark: string;
  voided: boolean;
  voidReason: string;
  voidedAt: string;
  drawings: ProjectDrawing[];
};

export function parseProjectNotes(notes: string | null | undefined): ProjectNotes {
  const meta = parseJsonMeta(notes);
  return {
    address: String(meta.address ?? ""),
    remark: String(meta.remark ?? meta.text ?? ""),
    voided: Boolean(meta.voided ?? false),
    voidReason: String(meta.voidReason ?? ""),
    voidedAt: String(meta.voidedAt ?? ""),
    drawings: Array.isArray(meta.drawings) ? (meta.drawings as ProjectDrawing[]) : []
  };
}

export function stringifyProjectNotes(notes: Partial<ProjectNotes>) {
  return stringifyJsonMeta({
    address: notes.address ?? "",
    remark: notes.remark ?? "",
    voided: notes.voided ?? false,
    voidReason: notes.voidReason ?? "",
    voidedAt: notes.voidedAt ?? "",
    drawings: notes.drawings ?? []
  });
}

export function drawingLabel(drawings: ProjectDrawing[], drawingId: unknown) {
  const drawing = drawings.find((item) => item.id === drawingId);
  return drawing ? `${drawing.drawingNo} / ${drawing.name}` : "未关联图号";
}
