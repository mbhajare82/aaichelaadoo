import { useState } from "react";
import { fmtWeight, rupee, http, errMsg } from "@/lib/api";
import { toast } from "sonner";

export const waNumber = (n) => {
  const d = (n || "").replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
};

export const waLink = (settings, text) => `https://wa.me/${waNumber(settings.whatsapp_number)}?text=${encodeURIComponent(text)}`;

export const waEnabled = (settings) => !!(settings?.whatsapp_enabled && settings?.whatsapp_number);

export const cartMessage = (settings, items, quote, destination, ref) => {
  const lines = items.map((i) => `- ${i.name}${i.kind === "combo" ? " (combo)" : ` ${fmtWeight(i.grams)}`} x ${i.qty} = ${rupee(i.unit_price * i.qty)}`);
  const extra = quote
    ? [`Items: ${rupee(quote.subtotal)}`, `Delivery (${destination === "india" ? "India" : "Abroad"}, ${fmtWeight(quote.weight_g)}): ${rupee(quote.delivery_fee)}`, `Total: ${rupee(quote.total)}`]
    : [];
  return [settings.whatsapp_message, ...(ref ? [`Order ref: ${ref}`] : []), "", ...lines, "", ...extra, "", "Name:", "Delivery address:"].join("\n");
};

const WaIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.43 9.43 0 1 1 8 4.42zm8.02-17.46A11.27 11.27 0 0 0 12.05.7C5.8.7.72 5.78.72 12.03c0 2 .52 3.95 1.52 5.66L.62 23.3l5.75-1.5a11.3 11.3 0 0 0 5.67 1.45h.01c6.25 0 11.33-5.08 11.33-11.33 0-3.03-1.18-5.87-3.31-8z" />
  </svg>
);

export const WhatsAppFloat = ({ settings }) => {
  if (!waEnabled(settings)) return null;
  return (
    <a
      href={waLink(settings, settings.whatsapp_message)} target="_blank" rel="noopener noreferrer" aria-label="Order on WhatsApp"
      className="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3.5 font-semibold text-[#0A0F1D] shadow-[0_10px_30px_rgba(37,211,102,0.35)] transition-transform duration-200 hover:scale-105"
      data-testid="whatsapp-float-button"
    >
      <WaIcon className="h-5 w-5" /> <span className="hidden text-sm sm:inline">Order on WhatsApp</span>
    </a>
  );
};

export const WhatsAppCartButton = ({ settings, items, quote, destination }) => {
  const [busy, setBusy] = useState(false);
  if (!waEnabled(settings) || !items.length) return null;
  const send = async () => {
    const win = window.open("", "_blank");
    setBusy(true);
    let ref = "";
    try {
      const { data } = await http.post("/whatsapp-orders", {
        items: items.map((i) => ({ kind: i.kind, id: i.id, grams: i.grams || null, qty: i.qty })), destination,
      });
      ref = data.id;
    } catch (err) {
      toast.error(errMsg(err));
      win?.close();
      setBusy(false);
      return;
    }
    const url = waLink(settings, cartMessage(settings, items, quote, destination, ref));
    if (win) win.location.href = url;
    else window.location.href = url;
    setBusy(false);
  };
  return (
    <button
      type="button" onClick={send} disabled={busy || !quote || quote.errors.length > 0}
      className="flex w-full items-center justify-center gap-2 rounded-full border border-[#25D366] py-3 text-sm font-bold text-[#25D366] transition-colors duration-200 hover:bg-[#25D366] hover:text-[#0A0F1D] disabled:opacity-50"
      data-testid="cart-whatsapp-button"
    >
      <WaIcon className="h-4 w-4" /> Order this cart on WhatsApp
    </button>
  );
};
