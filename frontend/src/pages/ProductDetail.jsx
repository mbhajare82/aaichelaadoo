import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Leaf } from "lucide-react";
import { http, rupee } from "@/lib/api";
import { Header } from "@/components/site/Header";
import { CartSheet } from "@/components/site/CartSheet";
import { Footer } from "@/components/site/Footer";
import { PackBuy, StockBadge } from "@/components/site/ProductCard";

const catLabel = { sweets: "Sweets", namkin: "Namkin", healthy: "Healthy food" };
export const NUTRIENTS = [
  ["energy_kcal", "Energy", "kcal"], ["protein_g", "Protein", "g"], ["carbs_g", "Carbohydrates", "g"],
  ["fat_g", "Fat", "g"], ["fibre_g", "Fibre", "g"], ["sugar_g", "Sugar", "g"],
];

const NutritionTable = ({ n }) => {
  const rows = NUTRIENTS.filter(([k]) => n?.[k] !== null && n?.[k] !== undefined);
  if (!rows.length) return null;
  return (
    <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5" data-testid="product-nutrition">
      <h2 className="flex items-center gap-2 text-base font-semibold text-emerald-300 md:text-lg"><Leaf className="h-4 w-4" /> Nutritional values</h2>
      <p className="text-xs text-slate-400">Approximate, per 100 g</p>
      <table className="mt-3 w-full text-sm">
        <tbody>
          {rows.map(([k, l, u]) => (
            <tr key={k} className="border-b border-slate-700/60 last:border-0">
              <td className="py-2 text-slate-300">{l}</td>
              <td className="py-2 text-right font-semibold" data-testid={`nutrition-${k}`}>{n[k]} {u}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Details = ({ p }) => (
  <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
    <div className="relative self-start overflow-hidden rounded-3xl bg-slate-800">
      {p.image ? <img src={p.image} alt={p.name} className="aspect-[4/3] w-full object-cover" /> : (
        <div className="grid aspect-[4/3] w-full place-items-center"><img src="/logo192.png" alt="" className="h-24 w-24 opacity-60" /></div>
      )}
      <StockBadge product={p} />
    </div>
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">{catLabel[p.category]}</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl" data-testid="product-detail-name">{p.name}</h1>
      <p className="mt-3 text-sm text-slate-300 sm:text-base">{p.description}</p>
      <p className="mt-2 text-sm text-slate-400">{rupee(p.price_per_kg)} / kg</p>
      <div className="max-w-sm"><PackBuy product={p} /></div>
      <div className="mt-8" data-testid="product-ingredients">
        <h2 className="text-base font-semibold md:text-lg">Contents</h2>
        {p.ingredients?.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {p.ingredients.map((i) => <li key={i} className="rounded-full border border-slate-600 bg-[#1E293B] px-3 py-1 text-sm text-slate-200">{i}</li>)}
          </ul>
        ) : <p className="mt-2 text-sm text-slate-400">Contents will be updated soon.</p>}
      </div>
      <NutritionTable n={p.nutrition} />
    </div>
  </div>
);

export default function ProductDetail() {
  const { id } = useParams();
  const [catalog, setCatalog] = useState(null);
  const load = () => http.get("/catalog").then(({ data }) => setCatalog(data));
  useEffect(() => {
    load();
    window.scrollTo(0, 0);
  }, [id]);
  const p = catalog?.products.find((x) => x.id === id);
  return (
    <div className="grid-paper grain relative min-h-screen text-slate-100" data-testid="product-detail-page">
      <Header />
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Link to="/#menu" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-amber-400" data-testid="product-detail-back"><ArrowLeft className="h-4 w-4" /> Back to menu</Link>
        {!catalog ? <p className="text-slate-400">Loading…</p> : p ? <Details p={p} /> : <p className="text-slate-400" data-testid="product-not-found">This item is not available.</p>}
      </main>
      <Footer />
      <CartSheet settings={catalog?.settings} onOrderPaid={load} />
    </div>
  );
}
