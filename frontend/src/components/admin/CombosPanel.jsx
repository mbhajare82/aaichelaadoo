import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { http, rupee, fmtWeight, errMsg } from "@/lib/api";

const inputCls = "border-slate-600 bg-slate-950 text-slate-100";

const ComboForm = ({ initial, products, onSaved, onClose }) => {
  const [f, setF] = useState(initial);
  const setItem = (i, k, v) => setF({ ...f, items: f.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) });
  const save = async (e) => {
    e.preventDefault();
    const body = { name: f.name, price: Number(f.price), description: f.description || "", active: f.active,
      items: f.items.map((it) => ({ product_id: it.product_id, grams: Number(it.grams) })) };
    try {
      if (initial.id) await http.put(`/admin/combos/${initial.id}`, body);
      else await http.post("/admin/combos", body);
      toast.success("Combo saved");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Name</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} data-testid="combo-form-name" /></div>
        <div><Label className="text-xs">Price (₹)</Label><Input required type="number" min="1" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} className={inputCls} data-testid="combo-form-price" /></div>
      </div>
      <Label className="text-xs">Items & weight limit (grams)</Label>
      {f.items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <select required value={it.product_id} onChange={(e) => setItem(i, "product_id", e.target.value)} className="h-10 flex-1 rounded-md border border-slate-600 bg-slate-950 px-2 text-sm" data-testid={`combo-form-item-${i}`}>
            <option value="">Select item</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
          </select>
          <Input required type="number" min="50" step="50" value={it.grams} onChange={(e) => setItem(i, "grams", e.target.value)} className={`w-24 ${inputCls}`} data-testid={`combo-form-grams-${i}`} />
          <button type="button" onClick={() => setF({ ...f, items: f.items.filter((_, j) => j !== i) })} className="px-1 text-slate-400 hover:text-red-400"><X className="h-4 w-4" /></button>
        </div>
      ))}
      <button type="button" onClick={() => setF({ ...f, items: [...f.items, { product_id: "", grams: 250 }] })} className="text-xs font-semibold text-amber-400" data-testid="combo-form-add-item">+ Add item</button>
      <label className="flex items-center gap-2 text-sm"><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /> Show on website</label>
      <button disabled={!f.items.length} className="w-full rounded-full bg-amber-500 py-2.5 text-sm font-bold text-[#0A0F1D] disabled:opacity-50" data-testid="combo-form-save">Save combo</button>
    </form>
  );
};

export const CombosPanel = () => {
  const [list, setList] = useState([]);
  const [products, setProducts] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => http.get("/admin/combos").then(({ data }) => setList(data));
  useEffect(() => {
    load();
    http.get("/admin/products").then(({ data }) => setProducts(data));
  }, []);
  const del = async (c) => {
    if (!window.confirm(`Delete ${c.name}?`)) return;
    await http.delete(`/admin/combos/${c.id}`);
    load();
  };
  return (
    <div className="space-y-4">
      <button onClick={() => setEdit({ name: "", price: 999, description: "", active: true, items: [{ product_id: "", grams: 250 }] })} className="flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-[#0A0F1D]" data-testid="add-combo-button"><Plus className="h-4 w-4" /> Add combo</button>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {list.map((c) => (
          <div key={c.id} className="rounded-2xl border border-slate-700 bg-[#1E293B] p-5" data-testid={`admin-combo-${c.id}`}>
            <div className="flex items-start justify-between">
              <div><p className="font-semibold">{c.name} {!c.active && <span className="text-xs text-slate-500">(hidden)</span>}</p><p className="text-xl font-bold text-amber-400">{rupee(c.price)}</p></div>
              <div className="flex gap-2">
                <button onClick={() => setEdit({ ...c, items: c.items.map(({ product_id, grams }) => ({ product_id, grams })) })} className="rounded-full border border-slate-600 p-1.5 hover:border-amber-400" data-testid={`edit-combo-${c.id}`}><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => del(c)} className="rounded-full border border-slate-600 p-1.5 hover:border-red-400" data-testid={`delete-combo-${c.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-300">{c.items.map((i) => `${i.name} ${fmtWeight(i.grams)}`).join(" · ")}</p>
            {!c.in_stock && <p className="mt-2 text-xs text-red-400">Out of stock on website</p>}
          </div>
        ))}
      </div>
      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-amber-500/20 bg-[#0F172A] text-slate-100" data-testid="combo-form-dialog">
          <DialogHeader><DialogTitle className="text-amber-400">{edit?.id ? "Edit combo" : "Add combo"}</DialogTitle></DialogHeader>
          {edit && <ComboForm initial={edit} products={products} onSaved={load} onClose={() => setEdit(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};
