export function FormPanel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <h2 className="text-lg font-black text-ink">{title}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="form-label">{label}</span>
      {children}
    </label>
  );
}
