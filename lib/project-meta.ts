import { parseJsonMeta, stringifyJsonMeta } from "@/lib/json-meta";

export type ProjectDrawing = {
  id: string;
  drawingNo: string;
  name: string;
  version: string;
  remark: string;
  createdAt: string;
  voided?: boolean;
  voidReason?: string;
  voidedAt?: string;
  restoredAt?: string;
};

export type BomRow = {
  id: string;
  drawingNo: string;
  materialName: string;
  spec: string;
  material: string;
  unit: string;
  quantity: number;
  remark: string;
  materialCode: string;
  matchedMaterialId?: string;
  matchedSpecId?: string;
};

export type ProjectBom = {
  id: string;
  projectId: string;
  drawingId: string;
  drawingNo: string;
  fileName?: string;
  version: string;
  isCurrent: boolean;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByName?: string;
  projectCode?: string;
  orderPerson?: string;
  orderDate?: string;
  voided?: boolean;
  voidReason?: string;
  voidedAt?: string;
  restoredAt?: string;
  purchaseGeneratedAt?: string;
  purchaseRequestIds?: string[];
  rows: BomRow[];
};

export type ProjectNotes = {
  address: string;
  remark: string;
  voided: boolean;
  voidReason: string;
  voidedAt: string;
  drawings: ProjectDrawing[];
  boms: ProjectBom[];
};

export function parseProjectNotes(notes: string | null | undefined): ProjectNotes {
  const meta = parseJsonMeta(notes);
  return {
    address: String(meta.address ?? ""),
    remark: String(meta.remark ?? meta.text ?? ""),
    voided: Boolean(meta.voided ?? false),
    voidReason: String(meta.voidReason ?? ""),
    voidedAt: String(meta.voidedAt ?? ""),
    drawings: Array.isArray(meta.drawings) ? (meta.drawings as ProjectDrawing[]) : [],
    boms: Array.isArray(meta.boms) ? (meta.boms as ProjectBom[]) : []
  };
}

export function stringifyProjectNotes(notes: Partial<ProjectNotes>) {
  return stringifyJsonMeta({
    address: notes.address ?? "",
    remark: notes.remark ?? "",
    voided: notes.voided ?? false,
    voidReason: notes.voidReason ?? "",
    voidedAt: notes.voidedAt ?? "",
    drawings: notes.drawings ?? [],
    boms: notes.boms ?? []
  });
}

export function drawingLabel(drawings: ProjectDrawing[], drawingId: unknown) {
  const drawing = drawings.find((item) => item.id === drawingId);
  return drawing ? `${drawing.drawingNo} / ${drawing.name}${drawing.voided ? "（已作废）" : ""}` : "未关联图号";
}
