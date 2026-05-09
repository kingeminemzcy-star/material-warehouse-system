# Vercel 部署说明

1. 推送代码到 GitHub。
2. 登录 Vercel，导入仓库 `material-warehouse-system`。
3. Framework Preset 选择 Next.js。
4. 配置环境变量：
   - `DATABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`
5. Build Command：`npm run build`
6. Output Directory 保持默认。
7. 部署前确认数据库模型已推送：

```bash
npm run prisma:push
```

8. 在 Supabase Auth 设置中加入 Vercel 域名作为允许回调地址。
