import { useEffect, useState } from "react";
import { Users, Flame, ShoppingBag, IndianRupee } from "lucide-react";
import { http, rupee } from "@/lib/api";

export const StatsCards = () => {
  const [s, setS] = useState(null);
  useEffect(() => {
    http.get("/admin/stats").then(({ data }) => setS(data));
  }, []);
  const cards = [
    [Users, "Total leads", s?.total_leads, "stat-total-leads", "text-sky-300"],
    [Flame, "Hot this week", s?.hot_this_week, "stat-hot-this-week", "text-rose-400"],
    [ShoppingBag, "Paid orders", s?.paid_orders, "stat-paid-orders", "text-emerald-400"],
    [IndianRupee, "Revenue", s ? rupee(s.revenue) : undefined, "stat-revenue", "text-amber-400"],
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(([Icon, label, v, id, color]) => (
        <div key={id} className="rounded-2xl border border-slate-700 bg-[#1E293B] p-5">
          <Icon className={`h-5 w-5 ${color}`} />
          <p className="mt-3 text-xs uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1 font-outfit text-2xl font-bold sm:text-3xl" data-testid={id}>{v ?? "—"}</p>
        </div>
      ))}
    </div>
  );
};
