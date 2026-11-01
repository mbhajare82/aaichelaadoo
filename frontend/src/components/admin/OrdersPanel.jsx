import { useEffect, useState } from "react";
import { toast } from "sonner";
import { http, rupee, fmtWeight } from "@/lib/api";

const statuses = ["pending", "paid", "delivered", "failed", "cancelled"];

export const OrdersPanel = () => {
  const [list, setList] = useState([]);
  const load = () => http.get("/admin/orders").then(({ data }) => setList(data));
  useEffect(() => {
    load();
  }, []);
  const change = async (id, status) => {
    await http.patch(`/admin/orders/${id}`, { status });
    toast.success(`Order ${id} marked ${status}`);
    load();
  };
  if (!list.length) return <p className="text-slate-400" data-testid="orders-empty">No orders yet.</p>;
  return (
    <div className="space-y-3" data-testid="orders-list">
      {list.map((o) => (
        <div key={o.id} className="rounded-2xl border border-slate-700 bg-[#1E293B] p-5" data-testid={`order-${o.id}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-amber-400">{o.id} <span className="ml-2 text-xs font-normal text-slate-400">{new Date(o.created_at).toLocaleString("en-IN")}</span></p>
              <p className="text-sm">{o.customer.name} · {o.customer.phone}</p>
            </div>
            <select value={o.status} onChange={(e) => change(o.id, e.target.value)} className="h-9 rounded-md border border-slate-600 bg-slate-950 px-2 text-sm capitalize" data-testid={`order-status-${o.id}`}>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <p className="mt-2 text-sm text-slate-300">{o.lines.map((l) => `${l.name}${l.kind === "product" ? ` ${fmtWeight(l.grams)}` : ""} × ${l.qty}`).join(", ")}</p>
          <p className="mt-1 text-xs text-slate-400">{o.customer.address}, {o.customer.city} {o.customer.pincode}, {o.customer.country} · {o.destination === "abroad" ? "Abroad" : "India"} · {fmtWeight(o.weight_g)}</p>
          <p className="mt-2 text-sm">Items {rupee(o.subtotal)} + Delivery {rupee(o.delivery_fee)} = <span className="font-bold text-amber-400">{rupee(o.total)}</span></p>
        </div>
      ))}
    </div>
  );
};
