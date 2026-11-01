import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { http, errMsg } from "@/lib/api";

const inputCls = "border-slate-600 bg-slate-950 text-slate-100";

export const SettingsPanel = () => {
  const [s, setS] = useState(null);
  useEffect(() => {
    http.get("/admin/settings").then(({ data }) => setS(data));
  }, []);
  if (!s) return null;
  const save = async (e) => {
    e.preventDefault();
    try {
      const { data } = await http.put("/admin/settings", { ...s, india_per_kg: Number(s.india_per_kg), abroad_extra_per_kg: Number(s.abroad_extra_per_kg) });
      setS(data);
      toast.success("Delivery charges saved");
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  return (
    <form onSubmit={save} className="max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-[#1E293B] p-6" data-testid="settings-form">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">India delivery (₹ per kg)</Label><Input type="number" min="0" value={s.india_per_kg} onChange={(e) => setS({ ...s, india_per_kg: e.target.value })} className={inputCls} data-testid="settings-india-rate" /></div>
        <div><Label className="text-xs">Abroad extra (₹ per kg)</Label><Input type="number" min="0" value={s.abroad_extra_per_kg} onChange={(e) => setS({ ...s, abroad_extra_per_kg: e.target.value })} className={inputCls} data-testid="settings-abroad-rate" /></div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">How to count weight (orders under 1 kg are always charged as 1 kg)</Label>
        {[["round_up", "Round part kg up (1.2 kg → 2 kg)"], ["exact", "Exact weight (1.2 kg → 1.2 kg)"]].map(([v, l]) => (
          <label key={v} className="flex items-center gap-2 text-sm">
            <input type="radio" name="rounding" checked={s.rounding === v} onChange={() => setS({ ...s, rounding: v })} className="accent-amber-500" data-testid={`settings-rounding-${v}`} /> {l}
          </label>
        ))}
      </div>
      <p className="text-xs text-slate-400">Abroad orders pay India rate + abroad extra per kg.</p>
      <button className="rounded-full bg-amber-500 px-6 py-2.5 text-sm font-bold text-[#0A0F1D]" data-testid="settings-save-button">Save</button>
    </form>
  );
};
