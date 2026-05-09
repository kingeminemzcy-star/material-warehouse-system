import { statusTone } from "@/lib/demo-data";

const toneClass = {
  green: "bg-blue-100 text-blue-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  gray: "bg-slate-100 text-slate-700",
  blue: "bg-sky-100 text-sky-800"
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status-pill ${toneClass[statusTone(status)]}`}>{status}</span>;
}
