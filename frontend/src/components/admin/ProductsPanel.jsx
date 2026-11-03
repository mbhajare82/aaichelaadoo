import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Upload, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { http, errMsg } from "@/lib/api";
import { NUTRIENTS } from "@/pages/ProductDetail";

const blank = { name: "", category: "sweets", description: "", image: "", price_per_kg: 600, stock_grams: 5000, active: true, ingredients: [], nutrition: null };
const inputCls = "border-slate-600 bg-slate-950 text-slate-100";

const cleanNutrition = (n) => {
  const out = {};
  NUTRIENTS.forEach(([k]) => {
    if (n?.[k] !== "" && n?.[k] !== null && n?.[k] !== undefined) out[k] = Number(n[k]);
  });
  return Object.keys(out).length ? out : null;
};

const NutritionFields = ({ value, onChange }) => (
  <div className="rounded-xl border border-emerald-500/30 p-3" data-testid="product-form-nutrition">
    <Label className="text-xs text-emerald-300">Nutritional values (per 100 g)</Label>
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {NUTRIENTS.map(([k, l, u]) => (
        <div key={k}>
          <Label className="text-[11px] text-slate-400">{l} ({u})</Label>
          <Input type="number" min="0" step="0.1" value={value?.[k] ?? ""} onChange={(e) => onChange({ ...(value || {}), [k]: e.target.value })} className={`h-9 ${inputCls}`} data-testid={`product-form-nutrition-${k}`} />
        </div>
      ))}
    </div>
  </div>
);

const PriceCell = ({ p, onSaved }) => {
  const [v, setV] = useState(p.price_per_kg);
  const save = async () => {
    if (Number(v) === p.price_per_kg) return;
    try {
      await http.put(`/admin/products/${p.id}`, { ...p, price_per_kg: Number(v) });
      toast.success(`${p.name} price updated`);
      onSaved();
    } catch (err) {
      toast.error(errMsg(err));
      setV(p.price_per_kg);
    }
  };
  return (
    <div className="flex items-center gap-1">
      <span className="text-slate-400">₹</span>
      <Input type="number" min="1" value={v} onChange={(e) => setV(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className={`h-8 w-24 ${inputCls}`} data-testid={`inline-price-${p.id}`} />
    </div>
  );
};

export const PhotoPicker = ({ value, onChange }) => {
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    try {
      const { data } = await http.post("/admin/upload", fd);
      onChange(data.url);
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <Label className="text-xs">Photo</Label>
      <div className="mt-1 flex items-center gap-3">
        <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-600 bg-slate-950">
          {value ? <img src={value} alt="" className="h-full w-full object-cover" data-testid="product-form-photo-preview" /> : <ImageIcon className="m-auto mt-5 h-5 w-5 text-slate-600" />}
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-600 px-4 py-2 text-xs font-semibold hover:border-amber-400">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {value ? "Change photo" : "Upload photo"}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} disabled={busy} className="hidden" data-testid="product-form-photo-input" />
        </label>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">JPG, PNG or WEBP, up to 5 MB.</p>
    </div>
  );
};

const ProductForm = ({ initial, onSaved, onClose }) => {
  const [f, setF] = useState({ ...initial, stock_kg: initial.stock_grams / 1000, ingredients_text: (initial.ingredients || []).join("\n") });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const body = { name: f.name, category: f.category, description: f.description, image: f.image, active: f.active,
      price_per_kg: Number(f.price_per_kg), stock_grams: Math.round(Number(f.stock_kg) * 1000),
      ingredients: f.ingredients_text.split("\n").map((s) => s.trim()).filter(Boolean),
      nutrition: f.category === "healthy" ? cleanNutrition(f.nutrition) : null };
    try {
      if (initial.id) await http.put(`/admin/products/${initial.id}`, body);
      else await http.post("/admin/products", body);
      toast.success("Item saved");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  return (
    <form onSubmit={save} className="space-y-3">
      <div><Label className="text-xs">Name</Label><Input required value={f.name} onChange={set("name")} className={inputCls} data-testid="product-form-name" /></div>
      <div><Label className="text-xs">Category</Label>
        <select value={f.category} onChange={set("category")} className="h-10 w-full rounded-md border border-slate-600 bg-slate-950 px-3 text-sm" data-testid="product-form-category">
          <option value="sweets">Sweets</option><option value="namkin">Namkin</option><option value="healthy">Healthy food</option>
        </select>
      </div>
      <div><Label className="text-xs">Description</Label><Input value={f.description} onChange={set("description")} className={inputCls} data-testid="product-form-description" /></div>
      <PhotoPicker value={f.image} onChange={(image) => setF((cur) => ({ ...cur, image }))} />
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Price per kg (₹)</Label><Input required type="number" min="1" step="1" value={f.price_per_kg} onChange={set("price_per_kg")} className={inputCls} data-testid="product-form-price" /></div>
        <div><Label className="text-xs">Stock available (kg)</Label><Input required type="number" min="0" step="0.05" value={f.stock_kg} onChange={set("stock_kg")} className={inputCls} data-testid="product-form-stock" /></div>
      </div>
      <div><Label className="text-xs">Contents / ingredients (one per line)</Label><Textarea rows={4} value={f.ingredients_text} onChange={set("ingredients_text")} placeholder={"e.g. Gram flour\nGhee\nSugar"} className={`placeholder:text-slate-500 ${inputCls}`} data-testid="product-form-ingredients" /></div>
      {f.category === "healthy" && <NutritionFields value={f.nutrition} onChange={(nutrition) => setF((cur) => ({ ...cur, nutrition }))} />}
      <label className="flex items-center gap-2 text-sm"><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} data-testid="product-form-active" /> Show on website</label>
      <button className="w-full rounded-full bg-amber-500 py-2.5 text-sm font-bold text-[#0A0F1D]" data-testid="product-form-save">Save item</button>
    </form>
  );
};

export const ProductsPanel = () => {
  const [list, setList] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => http.get("/admin/products").then(({ data }) => setList(data));
  useEffect(() => {
    load();
  }, []);
  const del = async (p) => {
    if (!window.confirm(`Remove ${p.name} from the website permanently?`)) return;
    try {
      await http.delete(`/admin/products/${p.id}`);
      toast.success(`${p.name} removed`);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => setEdit(blank)} className="flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-[#0A0F1D]" data-testid="add-product-button"><Plus className="h-4 w-4" /> Add new item</button>
        <p className="text-xs text-slate-400">Change a price right in the table (press Enter to save). Use the pencil to edit details, the bin to remove an item.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-[#1E293B]">
        <table className="w-full min-w-[640px] text-left text-sm" data-testid="products-table">
          <thead className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-400">
            <tr><th className="p-4">Item</th><th className="p-4">Category</th><th className="p-4">Price/kg</th><th className="p-4">Stock</th><th className="p-4">Status</th><th className="p-4" /></tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-b border-slate-800" data-testid={`admin-product-row-${p.id}`}>
                <td className="p-4 font-semibold"><div className="flex items-center gap-3">{p.image && <img src={p.image} alt="" className="h-10 w-12 rounded-md object-cover" />}{p.name}</div></td>
                <td className="p-4 capitalize text-slate-300">{p.category}</td>
                <td className="p-4"><PriceCell key={p.price_per_kg} p={p} onSaved={load} /></td>
                <td className="p-4">{(p.stock_grams / 1000).toFixed(2)} kg {p.stock_grams < 250 && <span className="ml-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">Out of stock</span>}</td>
                <td className="p-4 text-slate-400">{p.active ? "Visible" : "Hidden"}</td>
                <td className="p-4"><div className="flex gap-2">
                  <button onClick={() => setEdit(p)} className="rounded-full border border-slate-600 p-1.5 hover:border-amber-400" data-testid={`edit-product-${p.id}`}><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => del(p)} className="rounded-full border border-slate-600 p-1.5 hover:border-red-400" data-testid={`delete-product-${p.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-amber-500/20 bg-[#0F172A] text-slate-100" data-testid="product-form-dialog">
          <DialogHeader><DialogTitle className="text-amber-400">{edit?.id ? "Edit item" : "Add item"}</DialogTitle></DialogHeader>
          {edit && <ProductForm initial={edit} onSaved={load} onClose={() => setEdit(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};
