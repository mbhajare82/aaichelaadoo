import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { fmtDeadline } from "./CheckoutDialog";

const DIWALI_DATES = ["2026-11-08", "2027-10-29", "2028-10-17"];

const nextDiwali = (now) =>
  DIWALI_DATES.map((d) => new Date(`${d}T00:00:00+05:30`)).find((d) => now < d.getTime() + 86400000);

const Unit = ({ v, l, id }) => (
  <span className="flex items-baseline gap-0.5" data-testid={`countdown-${id}`}>
    <span className="font-outfit text-base font-bold tabular-nums text-[#0A0F1D] sm:text-lg">{String(v).padStart(2, "0")}</span>
    <span className="text-[10px] font-semibold uppercase text-[#0A0F1D]/70">{l}</span>
  </span>
);

export const CountdownBanner = ({ settings }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const target = nextDiwali(now);
  if (!target) return null;
  const diff = target.getTime() - now;
  const label = target.toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
  const orderNote = settings
    ? settings.diwali_open
      ? `Last date for Diwali orders: ${fmtDeadline(settings.diwali_deadline)}`
      : "Diwali orders closed — regular orders welcome"
    : "";

  return (
    <div className="relative z-50 bg-amber-500 text-[#0A0F1D]" data-testid="diwali-countdown-banner">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2 text-sm sm:justify-between sm:px-6 lg:px-8">
        <p className="flex flex-wrap items-center justify-center gap-1.5 font-semibold">
          <Sparkles className="h-4 w-4" />
          {diff > 0 ? `Diwali on ${label} — order your faral early` : "Shubh Deepavali! Order your faral today"}
          {orderNote && <span className="ml-1 rounded-full bg-[#0A0F1D] px-2.5 py-0.5 text-xs font-semibold text-amber-400" data-testid="countdown-order-note">{orderNote}</span>}
        </p>
        {diff > 0 && (
          <div className="flex items-center gap-3">
            <Unit v={Math.floor(diff / 86400000)} l="days" id="days" />
            <Unit v={Math.floor(diff / 3600000) % 24} l="hrs" id="hours" />
            <Unit v={Math.floor(diff / 60000) % 60} l="min" id="minutes" />
            <Unit v={Math.floor(diff / 1000) % 60} l="sec" id="seconds" />
            <a href="#combos" className="hidden rounded-full bg-[#0A0F1D] px-3 py-1 text-xs font-semibold text-amber-400 transition-transform duration-200 hover:scale-105 sm:inline" data-testid="countdown-shop-link">Shop combos</a>
          </div>
        )}
      </div>
    </div>
  );
};
