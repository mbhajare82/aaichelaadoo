export const SectionTitle = ({ label, title, sub }) => (
  <div className="mb-10 max-w-2xl">
    <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">{label}</p>
    <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">{title}</h2>
    {sub && <p className="mt-3 text-sm text-slate-400 sm:text-base">{sub}</p>}
  </div>
);
