import { ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";

const links = [
  ["Combos", "#combos"],
  ["Sweets & Namkin", "#menu"],
  ["Feedback", "#feedback"],
  ["Testimonials", "#testimonials"],
];

export const Header = () => {
  const { count, setOpen } = useCart();
  return (
    <header className="sticky top-0 z-40 border-b border-amber-500/15 bg-[#0A0F1D]/80 backdrop-blur-xl" data-testid="site-header">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-2" data-testid="brand-logo-link">
          <img src="/logo192.png" alt="AAICHELADOO logo" className="h-10 w-10 rounded-full" data-testid="brand-logo" />
          <span className="font-cinzel text-lg font-bold tracking-wide text-amber-400 sm:text-xl">AAICHELADOO</span>
        </a>
        <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
          {links.map(([l, h]) => (
            <a key={h} href={h} className="transition-colors duration-200 hover:text-amber-400" data-testid={`nav-${h.slice(1)}`}>{l}</a>
          ))}
        </nav>
        <button
          onClick={() => setOpen(true)}
          className="relative flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-[#0A0F1D] transition-transform duration-200 hover:scale-105 active:scale-95"
          data-testid="open-cart-button"
        >
          <ShoppingBag className="h-4 w-4" />
          <span className="hidden sm:inline">Cart</span>
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#0A0F1D] px-1 text-xs text-amber-400" data-testid="cart-count">{count}</span>
        </button>
      </div>
    </header>
  );
};
