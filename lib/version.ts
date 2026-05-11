export const APP_VERSION = "v0.5.1-alpha";

export type ChangelogEntry = {
  version: string;
  updatedAt: string;
  changes: string[];
  bugFixes: string[];
  databaseImpact: "无" | "有";
};

export const changelog: ChangelogEntry[] = [
  {
    version: "v0.5.1-alpha",
    updatedAt: "2026-05-11",
    changes: [
      "BOM 打印版表头识别改为扫描前 30 行，不再默认第 0 行为真实表头。",
      "表头判定改为基于名称、数量、规格型号、单位、材质、序号等明细关键字段，命中 3 个以上才视为真实表头。",
      "BOM 导入页新增检测到的真实表头行号、字段映射结果展示，并支持手动切换表头行。"
    ],
    bugFixes: [
      "修复页眉中的项目号、填单人、日期等信息被误判为 BOM 明细表头的问题。",
      "过滤分页区域、重复表头和无效空行，识别失败时提示用户选择表头行而不是中断页面。"
    ],
    databaseImpact: "无"
  },
  {
    version: "v0.5.0-alpha",
    updatedAt: "2026-05-11",
    changes: [
      "BOM 中心升级为支持打印版工程 BOM，可自动跳过公司页眉、Logo、说明文字、空行和分页区域。",
      "新增真实表头位置自动识别，支持项目号、填单人、日期、部件位、序号、名称、规格型号、品牌、材质、单位、数量、库存、备注等字段。",
      "新增字段映射预览和手动映射调整，名称映射为材料名称、规格型号映射为规格、项目号映射为项目编码、部件位映射为图号/部位。",
      "支持保存 BOM 字段映射模板，同类型 BOM 下次上传时自动套用。"
    ],
    bugFixes: [
      "增强合并单元格 Excel 的空值兼容，部件位为空时会沿用上一行部件位。",
      "解析失败时展示错误文件、错误行和缺失字段原因，避免页面崩溃。"
    ],
    databaseImpact: "无"
  },
  {
    version: "v0.4.1-alpha",
    updatedAt: "2026-05-11",
    changes: [
      "BOM 导入增加上传数据预览，解析完成后显示有效行数和被跳过行数。",
      "BOM 文件解析兼容 Excel/CSV 的数组行和对象行结果，空行与异常行会被安全跳过。"
    ],
    bugFixes: [
      "修复 BOM 导入时单行解析结果不是数组导致 row.map is not a function 的运行时错误。",
      "解析失败时改为显示友好错误提示，并展示错误文件名、行号和原因，避免页面崩溃。"
    ],
    databaseImpact: "无"
  },
  {
    version: "v0.4.0-alpha",
    updatedAt: "2026-05-11",
    changes: [
      "进入 Phase 3 系统治理与安全控制，新增统一 RBAC 权限配置。",
      "页面访问增加权限保护，API 关键操作增加角色校验和危险操作二次确认。",
      "审批、入库、出库关键库存流程改为数据库事务处理，降低半成功风险。",
      "新增数据锁定规则：已审批采购、已入库、已出库、已完工项目、已发布 BOM 版本受保护。",
      "删除保护改为软删除，并为作废记录预留恢复接口。",
      "审计日志增强，记录修改前后数据、操作人、时间和可获取的 IP。"
    ],
    bugFixes: [
      "补强重复审批、重复入库、负库存拦截。",
      "项目删除不再物理删除，避免误删历史数据。"
    ],
    databaseImpact: "无"
  },
  {
    version: "v0.3.0-alpha",
    updatedAt: "2026-05-11",
    changes: [
      "进入 Phase 2 BOM 中心与材料标准化，新增 BOM 中心页面。",
      "支持 Excel 和 CSV 上传 BOM，自动识别图号、材料名称、规格、材质、单位、数量、备注字段。",
      "一个项目可保存多个 BOM，一个图号可保留多个 BOM 版本，并支持切换当前版本。",
      "BOM 上传后自动匹配已有材料，未匹配材料会提示创建材料档案。",
      "新增标准 materialCode 规则，按分类、材质、规格、厚度、长度生成编码，减少重复材料。",
      "新增 BOM 缺料分析，自动计算需求数量、当前库存和缺口数量，并支持一键生成采购申请。"
    ],
    bugFixes: [
      "修复项目编辑/作废时可能丢失项目图号和 BOM 元数据的问题。"
    ],
    databaseImpact: "无"
  },
  {
    version: "v0.2.0-alpha",
    updatedAt: "2026-05-11",
    changes: [
      "进入 Phase 1 项目材料闭环，新增项目详情页作为图号、采购清单、领料、退料和项目完工入口。",
      "每个项目支持维护多个图号，包含图号、图纸名称、版本号和备注。",
      "项目采购清单按图号汇总材料、规格、采购数量、已入库数量、已领料数量、退料数量、剩余数量和项目库存占用。",
      "采购申请、出库领料、项目退料入库支持关联项目图号，项目退料入库后自动增加库存并写入操作日志。",
      "新增项目完工按钮，完工前检查未退料数量，完工后项目进入只读状态。"
    ],
    bugFixes: [
      "修正项目统计中退料和剩余数量的计算口径，避免退料重复计入剩余。",
      "补强完工项目的新增采购、入库、出库、图号维护拦截。"
    ],
    databaseImpact: "无"
  },
  {
    version: "v0.1.1-alpha",
    updatedAt: "2026-05-11",
    changes: [
      "建立版本号显示机制，页面底部统一展示当前版本。",
      "新增 changelog 页面，用于记录版本、更新时间、更新内容、bug 修复和数据库影响。",
      "新增回滚说明文档，明确 tag 查看、版本切换、回滚和恢复 main 的流程。"
    ],
    bugFixes: [
      "修复 /inventory 页面 React children key 重复 warning。",
      "修复 /materials 页面 React children key 重复 warning。",
      "材料列表和库存列表改用数据库唯一 id，并在缺少 id 时使用 id + index 兜底。"
    ],
    databaseImpact: "无"
  },
  {
    version: "v0.1.0-alpha",
    updatedAt: "2026-05-09",
    changes: [
      "初始化 Next.js、TypeScript、Tailwind CSS、Prisma、Supabase 的 MVP 工程。",
      "完成登录、工程项目、材料档案、采购申请、老板审批、采购单、入库、出库、库存、操作日志等基础页面。",
      "完成 Supabase 数据库、登录、图片存储和 Vercel 部署说明。"
    ],
    bugFixes: ["初始版本，无历史 bug 修复记录。"],
    databaseImpact: "有"
  }
];
