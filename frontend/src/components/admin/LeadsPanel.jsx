import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { http } from "@/lib/api";

const labelCls = {
  Hot: "bg-rose-500/20 text-rose-400 border-rose-500/40",
  Warm: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  Cold: "bg-sky-500/20 text-sky-400 border-sky-500/40",
};

export const LeadLabel = ({ label }) => (
  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${labelCls[label] || labelCls.Cold}`}>{label}</span>
);

const LeadDialog = ({ id, onClose }) => {
  const [lead, setLead] = useState(null);
  useEffect(() => {
    if (id) http.get(`/admin/leads/${id}`).then(({ data }) => setLead(data));
    else setLead(null);
  }, [id]);
  const copy = async () => {
    await navigator.clipboard.writeText(lead.whatsapp_message);
    toast.success("WhatsApp message copied");
  };
  return (
    <Dialog open={!!id} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-amber-500/20 bg-[#0F172A] text-slate-100 sm:max-w-lg" data-testid="lead-detail-dialog">
        {!lead ? <p className="text-slate-400">Loading…</p> : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">{lead.name || "Unnamed lead"} <LeadLabel label={lead.label} /></DialogTitle>
              <DialogDescription className="text-slate-400">{new Date(lead.created_at).toLocaleString("en-IN")}</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              {[["Phone", lead.phone], ["Items", lead.items], ["Address", lead.address]].map(([k, v]) => (
                <div key={k}><dt className="text-xs uppercase tracking-wider text-slate-500">{k}</dt><dd>{v || "—"}</dd></div>
              ))}
            </dl>
            <div className="rounded-xl border border-slate-700 bg-[#1E293B] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Summary</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200" data-testid="lead-summary">{lead.summary}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">WhatsApp follow-up</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200" data-testid="lead-whatsapp-message">{lead.whatsapp_message}</p>
              <button onClick={copy} className="mt-3 flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-[#0A0F1D] transition-transform duration-200 hover:scale-105" data-testid="lead-copy-whatsapp-button">
                <Copy className="h-3.5 w-3.5" /> Copy message
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const LeadsPanel = () => {
  const [leads, setLeads] = useState([]);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    http.get("/admin/leads").then(({ data }) => setLeads(data));
  }, []);
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-[#1E293B]" data-testid="leads-table">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-400">
          <tr><th className="p-4">Label</th><th className="p-4">Name</th><th className="p-4">Phone</th><th className="p-4">Items</th><th className="p-4">Date</th></tr>
        </thead>
        <tbody>
          {leads.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400" data-testid="leads-empty">No leads yet. They appear when a visitor ends a chat with Laado.</td></tr>}
          {leads.map((l) => (
            <tr key={l.id} onClick={() => setOpen(l.id)} className="cursor-pointer border-b border-slate-800 transition-colors duration-150 hover:bg-slate-800/60" data-testid={`lead-row-${l.id}`}>
              <td className="p-4"><LeadLabel label={l.label} /></td>
              <td className="p-4 font-semibold">{l.name || "—"}</td>
              <td className="p-4">{l.phone || "—"}</td>
              <td className="max-w-[240px] truncate p-4 text-slate-300">{l.items || "—"}</td>
              <td className="p-4 text-slate-400">{new Date(l.created_at).toLocaleDateString("en-IN")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <LeadDialog id={open} onClose={() => setOpen(null)} />
    </div>
  );
};
