import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { http, rupee, fmtWeight, errMsg } from "@/lib/api";

const statuses = ["new", "confirmed", "delivered", "cancelled"];
const statusCls = {
  new: "bg-sky-500/20 text-sky-300", confirmed: "bg-amber-500/20 text-amber-300",
  delivered: "bg-emerald-500/20 text-emerald-300", cancelled: "bg-red-500/20 text-red-300",
};
const inputCls = "h-9 border-slate-600 bg-slate-950 text-sm text-slate-100";

const WaOrderCard = ({ o, onSaved }) => {
  const [f, setF] = useState({ customer_name: o.customer_name || "", customer_phone: o.customer_phone || "", note: o.note || "" });
  const patch = async (body, msg) => {
    try {
      await http.patch(`/admin/whatsapp-orders/${o.id}`, body);
      toast.success(msg);
      onSaved();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  return (
    <div className="rounded-2xl border border-slate-700 bg-[#1E293B] p-5" data-testid={`wa-order-${o.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-bold text-[#25D366]">{o.id}
          <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${statusCls[o.status]}`}>{o.status}</span>
          <span className="ml-2 text-xs font-normal text-slate-400">{new Date(o.created_at).toLocaleString("en-IN")}</span>
        </p>
        <select value={o.status} onChange={(e) => patch({ status: e.target.value }, `${o.id} marked ${e.target.value}`)} className="h-9 rounded-md border border-slate-600 bg-slate-950 px-2 text-sm capitalize" data-testid={`wa-order-status-${o.id}`}>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <p className="mt-2 text-sm text-slate-300">{o.lines.map((l) => `${l.name}${l.kind === "product" ? ` ${fmtWeight(l.grams)}` : ""} × ${l.qty}`).join(", ")}</p>
      <p className="mt-1 text-sm">Items {rupee(o.subtotal)} + Delivery {rupee(o.delivery_fee)} ({o.destination === "abroad" ? "Abroad" : "India"}, {fmtWeight(o.weight_g)}) = <span className="font-bold text-amber-400">{rupee(o.total)}</span></p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]">
        <Input placeholder="Customer name" value={f.customer_name} onChange={(e) => setF({ ...f, customer_name: e.target.value })} className={inputCls} data-testid={`wa-order-name-${o.id}`} />
        <Input placeholder="Phone" value={f.customer_phone} onChange={(e) => setF({ ...f, customer_phone: e.target.value })} className={inputCls} data-testid={`wa-order-phone-${o.id}`} />
        <Input placeholder="Note (address, delivery date…)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={inputCls} data-testid={`wa-order-note-${o.id}`} />
        <button onClick={() => patch(f, "Details saved")} className="rounded-full bg-amber-500 px-4 text-xs font-bold text-[#0A0F1D]" data-testid={`wa-order-save-${o.id}`}>Save</button>
      </div>
    </div>
  );
};

export const WhatsAppOrdersPanel = () => {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState("all");
  const load = () => http.get("/admin/whatsapp-orders").then(({ data }) => setList(data));
  useEffect(() => {
    load();
  }, []);
  if (!list.length) return <p className="text-slate-400" data-testid="wa-orders-empty">No WhatsApp orders yet. They appear here when a customer taps "Order this cart on WhatsApp".</p>;
  const shown = list.filter((o) => filter === "all" || o.status === filter);
  return (
    <div className="space-y-3" data-testid="wa-orders-list">
      <p className="text-xs text-slate-400">Customers send these from WhatsApp. Match the "Order ref" in their message. Stock is reduced when you mark an order confirmed or delivered, and added back if you cancel it.</p>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {["all", ...statuses].map((k) => (
          <button key={k} onClick={() => setFilter(k)} className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold capitalize ${filter === k ? "border-amber-400 bg-amber-500 text-[#0A0F1D]" : "border-slate-600 text-slate-300"}`} data-testid={`wa-orders-filter-${k}`}>
            {k} ({k === "all" ? list.length : list.filter((o) => o.status === k).length})
          </button>
        ))}
      </div>
      {shown.map((o) => <WaOrderCard key={o.id} o={o} onSaved={load} />)}
    </div>
  );
};
