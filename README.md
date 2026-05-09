# 工程材料入库出库管理系统 MVP

面向自动化喷涂生产线设备公司的联网版工程材料仓储系统。当前版本完成可运行的 Next.js MVP 壳、Prisma 数据库模型、基础权限入口、核心业务页面、Supabase 图片上传预留和部署说明。

## 已完成模块

- 登录与角色入口：老板/管理员、仓库员、采购员、项目经理
- 工程项目管理
- 材料档案管理：分类、规格型号、材质、尺寸、单位、唯一编码、二维码字段预留
- Excel 批量导入入口预留
- 采购申请：必须关联工程项目
- 老板审批：同意/拒绝入口
- 采购下单：供应商、价格、预计到货、状态
- 入库管理：采购到货、工程退料、库存盘盈、其他
- 出库管理：必须关联工程项目，展示当前库存
- 库存查询：按材料、规格、分类、库位、项目、库存不足筛选
- 照片管理：材料、入库、出库照片上传入口
- 操作记录/审计日志：人员、操作、材料、工程、库存变化、时间
- 扫码功能预留：`qrCode` / `qr_code` 字段和页面入口

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma
- Supabase Auth / Database / Storage
- Vercel

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 复制环境变量

```bash
cp .env.example .env
```

3. 本地仅查看 MVP 页面，可以先不配置 Supabase，直接启动

```bash
npm run dev
```

打开 `http://localhost:3000`。

4. 接入数据库后生成 Prisma Client 并推送模型

```bash
npm run prisma:generate
npm run prisma:push
```

## Supabase 配置

1. 在 Supabase 创建项目。
2. Project Settings -> Database 中复制 PostgreSQL connection string，填入 `.env` 的 `DATABASE_URL`。
3. Project Settings -> API 中复制：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Storage 新建 bucket：`warehouse-photos`。
5. 开发阶段可先设置 bucket 为 public；正式上线建议使用私有 bucket + 签名 URL。
6. Authentication 开启 Email 或手机号登录。
7. 在 `UserProfile` 表中维护 Supabase 用户 ID 与业务角色。
8. 根据角色配置 RLS：
   - 老板/管理员：全部数据、审批、报表、日志、账号管理
   - 仓库员：入库、出库、照片、库存
   - 采购员：已审批申请、采购单、采购状态
   - 项目经理：采购申请、领料申请、项目用料

## Vercel 部署

1. 将仓库推送到 GitHub。
2. 在 Vercel 导入该仓库。
3. Framework 选择 Next.js。
4. Environment Variables 填入 `.env.example` 中对应变量。
5. Build Command 使用：

```bash
npm run build
```

6. 首次部署前在本地或 CI 中执行：

```bash
npm run prisma:push
```

7. 部署完成后，将 Vercel 域名加入 Supabase Auth 的 Site URL / Redirect URLs。

## 数据库设计重点

- 库存按 `materialId + specId + zone + locationCode + sourceProjectId` 区分。
- 材料主档与规格表分离，钢材、板材、电机、风机、链条、喷枪、滤芯、电缆、轴承、气缸、油漆的规格字段均已预留。
- 采购流程使用 `PurchaseRequest -> PurchaseOrder -> InboundRecord` 串联。
- 入库、出库分别记录 `beforeQty` 和 `afterQty`，并通过 `AuditLog` 保留关键操作。
- 照片通过 `Photo` 关联材料、工程、入库单、出库单、操作人和时间。

## 下一步建议

- 将演示数据替换为 Prisma 查询和 Server Actions。
- 实现 Supabase Auth 中间件与角色权限拦截。
- 完成库存事务：入库增加、出库扣减、库存不足校验。
- 增加 Excel 解析导入材料档案。
- 使用摄像头/扫码枪实现二维码出入库。
