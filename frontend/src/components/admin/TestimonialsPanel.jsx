import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { http } from "@/lib/api";
import { Stars } from "@/components/site/Stars";

export const TestimonialsPanel = () => {
  const [list, setList] = useState([]);
  const load = () => http.get("/admin/testimonials").then(({ data }) => setList(data));
  useEffect(() => {
    load();
  }, []);
  const toggle = async (t, published) => {
    await http.patch(`/admin/testimonials/${t.id}`, { published });
    toast.success(published ? "Published on website" : "Hidden from website");
    load();
  };
  if (!list.length) return <p className="text-slate-400" data-testid="admin-testimonials-empty">No feedback received yet.</p>;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {list.map((t) => (
        <div key={t.id} className="rounded-2xl border border-slate-700 bg-[#1E293B] p-5" data-testid={`admin-testimonial-${t.id}`}>
          <div className="flex items-start justify-between gap-3">
            <div><p className="font-semibold">{t.name}</p><p className="text-xs text-slate-400">Order {t.order_id} · {t.phone}</p></div>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              {t.published ? "Published" : "Hidden"}
              <Switch checked={t.published} onCheckedChange={(v) => toggle(t, v)} data-testid={`publish-toggle-${t.id}`} />
            </label>
          </div>
          <p className="mt-3 text-sm text-slate-200">{t.comment}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-400">
            {[["Taste", t.taste], ["Price", t.price], ["Nourishment", t.nourishment]].map(([l, v]) => <div key={l}><p>{l}</p><Stars value={v} /></div>)}
          </div>
        </div>
      ))}
    </div>
  );
};
