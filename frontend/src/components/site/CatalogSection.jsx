import { useState } from "react";
import { Candy, Cookie, Sprout } from "lucide-react";
import { ProductCard } from "./ProductCard";
import { SectionTitle } from "./SectionTitle";

const tabs = [
  ["sweets", "Sweets", Candy],
  ["namkin", "Namkin", Cookie],
  ["healthy", "Healthy food", Sprout],
];

export const CatalogSection = ({ products, loading }) => {
  const [cat, setCat] = useState("sweets");
  const list = products.filter((p) => p.category === cat);
  return (
    <section id="menu" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" data-testid="catalog-section">
      <SectionTitle label="Menu" title="Pick by the pack" sub="Choose 250 g, 500 g or 1 kg of any item. Prices update as you choose." />
      <div className="no-scrollbar mb-8 flex gap-2 overflow-x-auto">
        {tabs.map(([key, label, Icon]) => (
          <button
            key={key} onClick={() => setCat(key)}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors duration-200 ${cat === key ? "border-amber-400 bg-amber-500 text-[#0A0F1D]" : "border-slate-600 text-slate-300 hover:border-amber-400"}`}
            data-testid={`category-tab-${key}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      {loading ? <p className="text-slate-400">Loading menu…</p> : list.length === 0 ? (
        <p className="text-slate-400" data-testid="catalog-empty">No items in this category yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </section>
  );
};
