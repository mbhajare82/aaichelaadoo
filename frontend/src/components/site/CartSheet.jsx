import { useEffect, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useCart } from "@/context/CartContext";
import { http, rupee, fmtWeight } from "@/lib/api";
import { CheckoutDialog } from "./CheckoutDialog";

const toLines = (items) => items.map((i) => ({ kind: i.kind, id: i.id, grams: i.grams || null, qty: i.qty }));

const QtyControl = ({ item }) => {
  const { setQty } = useCart();
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => setQty(item.key, item.qty - 1)} className="rounded-full border border-slate-600 p-1 hover:border-amber-400" data-testid={`cart-dec-${item.key}`}>
        {item.qty === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
      </button>
      <span className="w-5 text-center text-sm" data-testid={`cart-qty-${item.key}`}>{item.qty}</span>
      <button onClick={() => setQty(item.key, item.qty + 1)} className="rounded-full border border-slate-600 p-1 hover:border-amber-400" data-testid={`cart-inc-${item.key}`}>
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

const Row = ({ label, value, testid, strong }) => (
  <div className={`flex justify-between ${strong ? "text-base font-bold text-amber-400" : "text-sm text-slate-300"}`}>
    <span>{label}</span><span data-testid={testid}>{value}</span>
  </div>
);

export const CartSheet = ({ settings, onOrderPaid }) => {
  const { items, open, setOpen, destination, setDestination } = useCart();
  const [quote, setQuote] = useState(null);
  const [checkout, setCheckout] = useState(false);

  useEffect(() => {
    if (!items.length) {
      setQuote(null);
      return;
    }
    http.post("/cart/quote", { items: toLines(items), destination }).then(({ data }) => setQuote(data)).catch(() => setQuote(null));
  }, [items, destination, settings]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col border-amber-500/20 bg-[#0F172A] text-slate-100 sm:max-w-md" data-testid="cart-sheet">
        <SheetHeader>
          <SheetTitle className="text-amber-400">Your cart</SheetTitle>
          <SheetDescription className="text-slate-400">Delivery is charged by total weight.</SheetDescription>
        </SheetHeader>
        {!items.length ? (
          <p className="mt-10 text-center text-slate-400" data-testid="cart-empty">Your cart is empty.</p>
        ) : (
          <>
            <ul className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
              {items.map((i) => (
                <li key={i.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-[#1E293B] p-3" data-testid={`cart-item-${i.key}`}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{i.name}</p>
                    <p className="text-xs text-slate-400">{i.kind === "combo" ? "Combo" : fmtWeight(i.grams)} · {rupee(i.unit_price)}</p>
                  </div>
                  <QtyControl item={i} />
                </li>
              ))}
            </ul>
            <div className="space-y-3 border-t border-slate-700 pt-4">
              <div className="grid grid-cols-2 gap-2 rounded-full bg-slate-800 p-1">
                {["india", "abroad"].map((d) => (
                  <button key={d} onClick={() => setDestination(d)}
                    className={`rounded-full py-2 text-sm font-semibold transition-colors duration-200 ${destination === d ? "bg-amber-500 text-[#0A0F1D]" : "text-slate-300"}`}
                    data-testid={`destination-${d}`}>
                    {d === "india" ? "Within India" : "Abroad"}
                  </button>
                ))}
              </div>
              {quote && (
                <div className="space-y-1.5">
                  <Row label="Items subtotal" value={rupee(quote.subtotal)} testid="cart-subtotal" />
                  <Row label={`Total weight`} value={fmtWeight(quote.weight_g)} testid="cart-weight" />
                  <Row label={`Delivery (${destination === "india" ? "India" : "Abroad"})`} value={rupee(quote.delivery_fee)} testid="cart-delivery-fee" />
                  <Row label="Total" value={rupee(quote.total)} testid="cart-total" strong />
                  {quote.errors.map((e) => <p key={e} className="text-xs text-red-400" data-testid="cart-error">{e}</p>)}
                </div>
              )}
              <button
                disabled={!quote || quote.errors.length > 0}
                onClick={() => setCheckout(true)}
                className="w-full rounded-full bg-amber-500 py-3 text-sm font-bold text-[#0A0F1D] transition-transform duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:bg-slate-600"
                data-testid="cart-checkout-button"
              >
                Checkout securely
              </button>
            </div>
          </>
        )}
        <CheckoutDialog open={checkout} onOpenChange={setCheckout} quote={quote} lines={toLines(items)} onPaid={onOrderPaid} />
      </SheetContent>
    </Sheet>
  );
};
