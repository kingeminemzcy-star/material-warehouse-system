import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "工程材料仓储系统",
  description: "自动化喷涂生产线工程材料入库出库管理 MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
