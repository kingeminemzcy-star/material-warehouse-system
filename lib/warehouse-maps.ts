export const categoryLabels = {
  STEEL: "钢材",
  PLATE: "板材",
  CHAIN: "链条",
  MOTOR: "电机",
  FAN: "风机",
  SPRAY_GUN: "喷枪",
  FILTER: "滤芯",
  HARDWARE: "五金件",
  CABLE: "电缆",
  BEARING: "轴承",
  CYLINDER: "气缸",
  PAINT: "油漆",
  OTHER: "其他"
} as const;

export type MaterialCategoryCode = keyof typeof categoryLabels;

export const categoryOptions = Object.entries(categoryLabels).map(([value, label]) => ({ value, label }));

export function categoryFromLabel(label: string): MaterialCategoryCode {
  const found = Object.entries(categoryLabels).find(([, value]) => value === label || value === label.trim());
  return (found?.[0] as MaterialCategoryCode | undefined) ?? (label as MaterialCategoryCode) ?? "OTHER";
}

export const zoneLabels = {
  STEEL_AREA: "钢材区",
  ELECTRICAL_AREA: "电气区",
  SPARE_PARTS_AREA: "备件区",
  SITE_TEMP_AREA: "现场暂存区",
  RETURN_AREA: "退料区",
  SCRAP_AREA: "废料区"
} as const;

export type ZoneCode = keyof typeof zoneLabels;

export const zoneOptions = Object.entries(zoneLabels).map(([value, label]) => ({ value, label }));

export function zoneFromLabel(label: string): ZoneCode {
  const found = Object.entries(zoneLabels).find(([, value]) => value === label || value === label.trim());
  return (found?.[0] as ZoneCode | undefined) ?? (label as ZoneCode) ?? "SPARE_PARTS_AREA";
}

export const purchaseStatusLabels = {
  PENDING_APPROVAL: "待审批",
  REJECTED: "已拒绝",
  APPROVED: "已审批",
  ORDERED: "已下单",
  PARTIAL_RECEIVED: "部分到货",
  COMPLETED: "已完成"
} as const;

export const inboundSourceLabels = {
  PURCHASE_ARRIVAL: "采购到货",
  PROJECT_RETURN: "工程退料",
  INVENTORY_GAIN: "库存盘盈",
  OTHER: "其他"
} as const;

export type InboundSourceCode = keyof typeof inboundSourceLabels;

export function inboundSourceFromLabel(label: string): InboundSourceCode {
  const found = Object.entries(inboundSourceLabels).find(([, value]) => value === label || value === label.trim());
  return (found?.[0] as InboundSourceCode | undefined) ?? (label as InboundSourceCode) ?? "OTHER";
}

export const units = ["根", "米", "件", "套", "公斤", "卷", "桶", "台", "个"];
