import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { http, errMsg } from "@/lib/api";
import { SectionTitle } from "./SectionTitle";
import { Stars } from "./Stars";

const empty = { order_id: "", phone: "", name: "", taste: 5, price: 5, nourishment: 5, comment: "" };
const ratings = [["taste", "Taste"], ["price", "Price"], ["nourishment", "Nourishment"]];

export const FeedbackSection = () => {
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const inputCls = "border-slate-600 bg-slate-900 text-slate-100";

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await http.post("/testimonials", f);
      toast.success("Thank you! Your feedback reached Aai's kitchen.");
      setF(empty);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="feedback" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" data-testid="feedback-section">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
        <div className="md:col-span-5">
          <SectionTitle label="Order feedback" title="Received your order? Tell us." sub="Use the order ID from your payment confirmation and the phone number used at checkout." />
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-700 bg-[#1E293B] p-6 md:col-span-7" data-testid="feedback-form">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input required placeholder="Order ID (e.g. AL1A2B3C)" value={f.order_id} onChange={(e) => setF({ ...f, order_id: e.target.value })} className={inputCls} data-testid="feedback-order-id-input" />
            <Input required placeholder="Phone" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={inputCls} data-testid="feedback-phone-input" />
            <Input required minLength={2} placeholder="Your name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} data-testid="feedback-name-input" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {ratings.map(([k, l]) => (
              <div key={k} className="rounded-xl border border-slate-700 p-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">{l}</p>
                <Stars value={f[k]} onChange={(n) => setF({ ...f, [k]: n })} testid={`feedback-${k}-stars`} />
              </div>
            ))}
          </div>
          <Textarea required minLength={5} placeholder="How was the taste, freshness and packing?" value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} className={inputCls} data-testid="feedback-comment-input" />
          <button disabled={busy} className="flex items-center gap-2 rounded-full bg-amber-500 px-6 py-2.5 text-sm font-semibold text-[#0A0F1D] transition-transform duration-200 hover:scale-105 disabled:opacity-60" data-testid="feedback-submit-button">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit feedback
          </button>
        </form>
      </div>
    </section>
  );
};
