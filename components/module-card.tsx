import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function ModuleCard({
  href,
  title,
  description,
  icon: Icon,
  meta
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  meta?: string;
}) {
  return (
    <Link href={href} className="block rounded-lg border border-line bg-white p-4 shadow-soft transition hover:border-action/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-field text-action">
          <Icon size={22} />
        </div>
        {meta ? <span className="text-sm font-bold text-warn">{meta}</span> : null}
      </div>
      <h2 className="mt-4 text-lg font-black text-ink">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-ink/62">{description}</p>
    </Link>
  );
}
