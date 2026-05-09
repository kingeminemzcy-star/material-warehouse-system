# Supabase 配置说明

## 环境变量

```bash
DATABASE_URL="postgresql://postgres:password@db.your-project.supabase.co:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="server-only-service-role-key"
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET="warehouse-photos"
```

## Storage

创建 `warehouse-photos` bucket，用于材料档案、入库、出库和操作凭证照片。

建议路径：

- `materials/{materialCode}/{timestamp}.jpg`
- `inbound/{inboundNo}/{timestamp}.jpg`
- `outbound/{outboundNo}/{timestamp}.jpg`
- `audit/{logId}/{timestamp}.jpg`

## Auth 和角色

Supabase Auth 负责登录，业务角色保存在 `UserProfile.role`。

角色建议：

- `ADMIN` / `BOSS`：全部数据、审批、报表、日志、账号管理
- `WAREHOUSE`：入库、出库、库存、照片
- `PURCHASER`：已审批采购申请、采购单、采购状态
- `PROJECT_MANAGER`：采购申请、项目领料和项目用料查询

## 数据初始化

```bash
npm run prisma:generate
npm run prisma:push
```

如果需要可使用 Supabase SQL Editor 检查 Prisma 创建的表。
