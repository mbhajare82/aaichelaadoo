import { motion } from "framer-motion";
import { Gift, Plus } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/context/CartContext";
import { rupee, fmtWeight } from "@/lib/api";
import { SectionTitle } from "./SectionTitle";

const catLabel = { sweets: "Sweets", namkin: "Namkin", healthy: "Healthy" };

const ComboCard = ({ combo, i }) => {
  const { add } = useCart();
  const onAdd = () => {
    add({ kind: "combo", id: combo.id, name: combo.name, unit_price: combo.price, grams: 0 });
    toast.success(`${combo.name} added to cart`);
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
      className="flex flex-col rounded-2xl border border-amber-500/30 bg-[#1E293B] p-6 shadow-[0_0_20px_rgba(245,158,11,0.08)] transition-transform duration-200 hover:-translate-y-1"
      data-testid={`combo-card-${combo.price}`}
    >
      <div className="flex items-center justify-between">
        <Gift className="h-6 w-6 text-amber-400" />
        {!combo.in_stock && <span className="rounded-full border border-red-500/40 bg-red-500/20 px-2 py-0.5 text-xs text-red-400" data-testid={`combo-out-of-stock-${combo.price}`}>Out of stock</span>}
      </div>
      <h3 className="mt-4 text-xl font-semibold">{combo.name}</h3>
      <p className="mt-1 font-outfit text-3xl font-extrabold text-amber-400" data-testid={`combo-price-${combo.price}`}>{rupee(combo.price)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(combo.category_limits || {}).map(([c, g]) => (
          <span key={c} className="rounded-full bg-[#1E3A8A]/60 px-2.5 py-1 text-xs text-sky-200">{catLabel[c] || c}: {fmtWeight(g)}</span>
        ))}
      </div>
      <ul className="mt-4 flex-1 space-y-1.5 border-t border-dashed border-slate-600 pt-4 text-sm text-slate-300">
        {combo.items.map((it) => (
          <li key={it.product_id} className="flex justify-between"><span>{it.name}</span><span className="text-slate-400">{fmtWeight(it.grams)}</span></li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">Total weight {fmtWeight(combo.total_grams)}</p>
      <button
        disabled={!combo.in_stock} onClick={onAdd}
        className="mt-5 flex items-center justify-center gap-2 rounded-full bg-amber-500 py-2.5 text-sm font-semibold text-[#0A0F1D] transition-transform duration-200 hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
        data-testid={`combo-add-${combo.price}`}
      >
        <Plus className="h-4 w-4" /> {combo.in_stock ? "Add combo" : "Out of stock"}
      </button>
    </motion.div>
  );
};

export const ComboSection = ({ combos, loading }) => (
  <section id="combos" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" data-testid="combo-section">
    <SectionTitle label="Combo offers" title="Ready Diwali boxes" sub="Sweets and namkin together, each with a fixed weight per item." />
    {loading ? <p className="text-slate-400">Loading combos…</p> : (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {combos.map((c, i) => <ComboCard key={c.id} combo={c} i={i} />)}
      </div>
    )}
  </section>
);
