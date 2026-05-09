import type { MaterialCategory, Role, StatusTone, Zone } from "@/lib/types";

export const currentUser = {
  name: "王总",
  role: "老板/管理员" as Role
};

export const roles: Role[] = ["老板/管理员", "仓库员", "采购员", "项目经理"];

export const zones: Zone[] = ["钢材区", "电气区", "备件区", "现场暂存区", "退料区", "废料区"];

export const categories: MaterialCategory[] = [
  "钢材",
  "板材",
  "链条",
  "电机",
  "风机",
  "喷枪",
  "滤芯",
  "五金件",
  "电缆",
  "轴承",
  "气缸",
  "油漆",
  "其他"
];

export const projects = [
  { code: "P-2026-018", name: "宁波喷涂线一期", manager: "陈工", status: "进行中", materialCost: "¥186,420" },
  { code: "P-2026-021", name: "苏州输送链改造", manager: "李工", status: "备料中", materialCost: "¥42,800" },
  { code: "P-2026-026", name: "合肥烘干炉配套", manager: "周工", status: "待开工", materialCost: "¥15,900" }
];

export const materials = [
  {
    code: "MAT-ST-0001",
    name: "矩形管",
    category: "钢材",
    spec: "100x50x4",
    material: "Q235B",
    dimensions: "6000mm",
    unit: "根",
    zone: "钢材区",
    stock: 86,
    minStock: 20
  },
  {
    code: "MAT-MO-0008",
    name: "减速电机",
    category: "电机",
    spec: "YE3-132M",
    material: "铸铝",
    dimensions: "7.5kW/380V/1450rpm",
    unit: "台",
    zone: "电气区",
    stock: 4,
    minStock: 3
  },
  {
    code: "MAT-PA-0015",
    name: "环氧底漆",
    category: "油漆",
    spec: "EP-210",
    material: "灰色",
    dimensions: "20kg/桶 批次 B2604",
    unit: "桶",
    zone: "备件区",
    stock: 12,
    minStock: 8
  },
  {
    code: "MAT-CA-0021",
    name: "动力电缆",
    category: "电缆",
    spec: "YJV",
    material: "铜芯",
    dimensions: "4芯 6平方 100m",
    unit: "卷",
    zone: "电气区",
    stock: 6,
    minStock: 4
  }
];

export const purchaseRequests = [
  {
    no: "PR-20260509-001",
    project: "宁波喷涂线一期",
    applicant: "陈工",
    material: "矩形管 Q235B 100x50x4",
    quantity: "40 根",
    purpose: "平台框架补料",
    expected: "2026-05-16",
    status: "待审批"
  },
  {
    no: "PR-20260508-004",
    project: "苏州输送链改造",
    applicant: "李工",
    material: "链条 16A-1 节距25.4",
    quantity: "120 米",
    purpose: "输送段更换",
    expected: "2026-05-14",
    status: "已审批"
  }
];

export const purchaseOrders = [
  {
    no: "PO-20260508-002",
    request: "PR-20260508-004",
    supplier: "苏州恒力机电",
    purchaser: "赵采购",
    amount: "¥18,600",
    eta: "2026-05-14",
    status: "已下单"
  },
  {
    no: "PO-20260505-006",
    request: "PR-20260503-002",
    supplier: "宁波钢贸",
    purchaser: "赵采购",
    amount: "¥32,400",
    eta: "2026-05-10",
    status: "部分到货"
  }
];

export const inventory = materials.map((item, index) => ({
  ...item,
  project: index === 2 ? "工程退料" : "通用库存",
  lastInbound: "2026-05-08 15:20",
  lastOutbound: index === 0 ? "2026-05-09 09:12" : "-"
}));

export const auditLogs = [
  { actor: "张仓管", action: "入库", target: "矩形管", project: "宁波喷涂线一期", change: "+30 根", before: "56", after: "86", time: "2026-05-09 10:31" },
  { actor: "王总", action: "审批", target: "链条", project: "苏州输送链改造", change: "同意", before: "-", after: "-", time: "2026-05-08 16:18" },
  { actor: "赵采购", action: "采购下单", target: "链条", project: "苏州输送链改造", change: "120 米", before: "-", after: "-", time: "2026-05-08 17:05" },
  { actor: "张仓管", action: "出库", target: "动力电缆", project: "合肥烘干炉配套", change: "-1 卷", before: "7", after: "6", time: "2026-05-07 14:42" }
];

export function statusTone(status: string): StatusTone {
  if (["已审批", "已完成", "进行中", "已采购完成", "已全部入库", "待入库"].includes(status)) return "green";
  if (["待审批", "备料中", "已下单", "采购中", "待到货验收", "部分到货"].includes(status)) return "amber";
  if (["已拒绝", "库存不足"].includes(status)) return "red";
  if (["待开工"].includes(status)) return "blue";
  return "gray";
}
