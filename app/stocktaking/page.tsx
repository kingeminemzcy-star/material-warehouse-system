import { AppShell } from "@/components/app-shell";
import { StocktakingClient } from "./stocktaking-client";

export default function StocktakingPage() {
  return (
    <AppShell title="库存盘点" subtitle="填写实际盘点数量，盘盈盘亏原因会写入操作日志并更新库存">
      <StocktakingClient />
    </AppShell>
  );
}
