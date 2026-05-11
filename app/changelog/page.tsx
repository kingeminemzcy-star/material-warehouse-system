import { AppShell } from "@/components/app-shell";
import { changelog } from "@/lib/version";

export default function ChangelogPage() {
  return (
    <AppShell title="更新日志" subtitle="记录版本发布、bug 修复和数据库影响，方便内部试用追溯">
      <div className="grid gap-4">
        {changelog.map((entry) => (
          <section key={entry.version} className="rounded-lg border border-line bg-white p-4">
            <div className="flex flex-col gap-2 border-b border-line pb-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black text-ink">{entry.version}</h2>
                <p className="mt-1 text-sm font-semibold text-ink/55">更新时间：{entry.updatedAt}</p>
              </div>
              <span className="w-fit rounded-md bg-blue-50 px-3 py-2 text-sm font-black text-blue-800">
                数据库影响：{entry.databaseImpact}
              </span>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-black text-ink">更新内容</h3>
                <ul className="grid gap-2 text-sm text-ink/72">
                  {entry.changes.map((item, index) => (
                    <li key={`${entry.version}-change-${index}`}>- {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-black text-ink">Bug 修复</h3>
                <ul className="grid gap-2 text-sm text-ink/72">
                  {entry.bugFixes.map((item, index) => (
                    <li key={`${entry.version}-fix-${index}`}>- {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
