export const APP_VERSION = "v0.2.0-alpha";

export type ChangelogEntry = {
  version: string;
  updatedAt: string;
  changes: string[];
  bugFixes: string[];
  databaseImpact: "无" | "有";
};

export const changelog: ChangelogEntry[] = [
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
