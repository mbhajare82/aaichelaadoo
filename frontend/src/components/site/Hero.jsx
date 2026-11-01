import { motion } from "framer-motion";
import { MapPin, Leaf, Flame, Truck } from "lucide-react";

const stats = [
  [Flame, "Homemade in small batches"],
  [Leaf, "Sweets, namkin & healthy food"],
  [Truck, "Delivery across India & abroad"],
];

export const Hero = ({ settings }) => (
  <section id="top" className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16 lg:px-8" data-testid="hero-section">
    <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-12">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="md:col-span-7">
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-400">
          <MapPin className="h-3.5 w-3.5" /> Homemade in Warje, Pune
        </span>
        <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          Aai's Diwali <span className="text-amber-400">faral</span>,<br className="hidden sm:block" /> made at home.
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
          Laddu, chakli, chivda, karanji and healthy treats — prepared in small batches the Maharashtrian way. Pick a combo or build your own box.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#combos" className="rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-[#0A0F1D] transition-transform duration-200 hover:scale-105" data-testid="hero-combos-cta">See combo offers</a>
          <a href="#menu" className="rounded-full border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-100 transition-colors duration-200 hover:border-amber-400 hover:text-amber-400" data-testid="hero-menu-cta">Browse menu</a>
        </div>
        <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map(([Icon, t]) => (
            <li key={t} className="flex items-center gap-2 text-xs text-slate-300 sm:text-sm">
              <Icon className="h-4 w-4 text-amber-400" /> {t}
            </li>
          ))}
        </ul>
      </motion.div>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.1 }} className="relative md:col-span-5">
        <div className="absolute -left-4 -top-4 h-full w-full rounded-3xl border-2 border-dashed border-amber-500/40" />
        <img src="/images/laddu.jpg" alt="Homemade laddu" className="relative aspect-[4/5] w-full rounded-3xl object-cover shadow-2xl" />
        {settings && (
          <div className="absolute -bottom-5 left-4 right-4 rounded-2xl border border-amber-500/30 bg-slate-900/85 p-4 text-xs backdrop-blur-xl sm:text-sm" data-testid="hero-delivery-note">
            <p className="font-semibold text-amber-400">Delivery charges</p>
            <p className="mt-1 text-slate-300">India ₹{settings.india_per_kg}/kg (min 1 kg) · Abroad +₹{settings.abroad_extra_per_kg}/kg extra</p>
          </div>
        )}
      </motion.div>
    </div>
  </section>
);
