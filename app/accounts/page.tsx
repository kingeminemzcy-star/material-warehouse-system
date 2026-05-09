import { AppShell } from "@/components/app-shell";
import { AccountsClient } from "./accounts-client";

export default function AccountsPage() {
  return (
    <AppShell title="账号管理" subtitle="老板/管理员可创建账号、修改姓名角色、禁用账号和重置密码">
      <AccountsClient />
    </AppShell>
  );
}
