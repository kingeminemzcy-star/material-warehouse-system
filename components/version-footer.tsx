import Link from "next/link";
import { APP_VERSION } from "@/lib/version";

export function VersionFooter() {
  return (
    <footer className="border-t border-line px-4 py-4 text-xs font-semibold text-ink/50 md:px-7">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>工程材料仓储系统 {APP_VERSION}</span>
        <Link href="/changelog" className="text-blue-700 hover:text-blue-900">
          更新日志
        </Link>
      </div>
    </footer>
  );
}
