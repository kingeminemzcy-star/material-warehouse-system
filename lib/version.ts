export const APP_VERSION = "v0.1.1-alpha";

export type ChangelogEntry = {
  version: string;
  updatedAt: string;
  changes: string[];
  bugFixes: string[];
  databaseImpact: "无" | "有";
};

export const changelog: ChangelogEntry[] = [
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
