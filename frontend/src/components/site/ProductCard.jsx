import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/context/CartContext";
import { rupee, fmtWeight } from "@/lib/api";

export const ProductCard = ({ product }) => {
  const { add } = useCart();
  const firstAvail = product.packs.find((p) => p.in_stock) || product.packs[0];
  const [grams, setGrams] = useState(firstAvail.grams);
  const pack = product.packs.find((p) => p.grams === grams);
  const onAdd = () => {
    add({ kind: "product", id: product.id, name: product.name, grams, unit_price: pack.price, image: product.image });
    toast.success(`${product.name} (${fmtWeight(grams)}) added`);
  };
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#1E293B] transition-transform duration-200 hover:-translate-y-1 hover:border-amber-500/50" data-testid={`product-card-${product.id}`}>
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-800">
        {product.image && <img src={product.image} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
        <span className={`absolute left-3 top-3 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${product.in_stock ? "border-emerald-500/40 bg-emerald-950/80 text-emerald-400" : "border-red-500/40 bg-red-950/80 text-red-400"}`} data-testid={`product-stock-${product.id}`}>
          {product.in_stock ? "In stock" : "Out of stock"}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-semibold">{product.name}</h3>
        <p className="mt-1 flex-1 text-sm text-slate-400">{product.description}</p>
        <p className="mt-2 text-xs text-slate-500">{rupee(product.price_per_kg)} / kg</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {product.packs.map((p) => (
            <button
              key={p.grams} disabled={!p.in_stock} onClick={() => setGrams(p.grams)}
              className={`rounded-lg border py-1.5 text-xs font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${grams === p.grams ? "border-amber-400 bg-amber-500/15 text-amber-300" : "border-slate-600 text-slate-300 hover:border-amber-400"}`}
              data-testid={`pack-${product.id}-${p.grams}`}
            >
              {fmtWeight(p.grams)}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="font-outfit text-2xl font-bold text-amber-400" data-testid={`product-price-${product.id}`}>{rupee(pack.price)}</span>
          <button
            disabled={!pack.in_stock} onClick={onAdd}
            className="flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-[#0A0F1D] transition-transform duration-200 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
            data-testid={`add-to-cart-${product.id}`}
          >
            <Plus className="h-4 w-4" /> {pack.in_stock ? "Add" : "Out of stock"}
          </button>
        </div>
      </div>
    </div>
  );
};
