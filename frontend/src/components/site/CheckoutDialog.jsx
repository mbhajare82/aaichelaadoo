import { useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCart } from "@/context/CartContext";
import { http, rupee, errMsg } from "@/lib/api";

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

const empty = { name: "", phone: "", email: "", address: "", city: "", pincode: "", country: "India" };

const Field = ({ id, label, children }) => (
  <div className="space-y-1.5"><Label htmlFor={id} className="text-xs text-slate-300">{label}</Label>{children}</div>
);

export const CheckoutDialog = ({ open, onOpenChange, quote, lines, onPaid }) => {
  const { destination, clear } = useCart();
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [paidId, setPaidId] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const inputCls = "border-slate-600 bg-slate-900 text-slate-100";

  const pay = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Could not load the payment window. Check your internet and retry.");
      const customer = { ...f, country: destination === "india" ? "India" : f.country };
      const { data } = await http.post("/orders", { items: lines, destination, customer });
      const rzp = new window.Razorpay({
        key: data.key_id, amount: data.amount, currency: data.currency, order_id: data.razorpay_order_id,
        name: "AaicheLadau", description: `Order ${data.order_id}`,
        prefill: { name: f.name, contact: f.phone, email: f.email },
        theme: { color: "#F59E0B" },
        handler: async (res) => {
          try {
            await http.post("/orders/verify", { order_id: data.order_id, ...res });
            setPaidId(data.order_id);
            clear();
            onPaid?.();
          } catch (err) {
            toast.error(errMsg(err));
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on("payment.failed", () => toast.error("Payment failed. Please try again."));
      rzp.open();
    } catch (err) {
      toast.error(errMsg(err));
      setBusy(false);
    }
  };

  const close = (v) => {
    onOpenChange(v);
    if (!v) { setPaidId(null); setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-amber-500/20 bg-[#0F172A] text-slate-100 sm:max-w-lg" data-testid="checkout-dialog">
        {paidId ? (
          <div className="py-6 text-center" data-testid="order-success">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
            <h3 className="mt-4 text-2xl font-bold">Dhanyavaad! Order placed</h3>
            <p className="mt-2 text-slate-300">Your order ID is <span className="font-bold text-amber-400" data-testid="order-success-id">{paidId}</span>. Keep it to share feedback once you receive the order.</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-amber-400">Delivery details</DialogTitle>
              <DialogDescription className="text-slate-400">Pay {quote ? rupee(quote.total) : ""} securely with Razorpay.</DialogDescription>
            </DialogHeader>
            <form onSubmit={pay} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field id="co-name" label="Full name"><Input id="co-name" required minLength={2} value={f.name} onChange={set("name")} className={inputCls} data-testid="checkout-name-input" /></Field>
                <Field id="co-phone" label="Phone"><Input id="co-phone" required minLength={7} type="tel" value={f.phone} onChange={set("phone")} className={inputCls} data-testid="checkout-phone-input" /></Field>
              </div>
              <Field id="co-email" label="Email (optional)"><Input id="co-email" type="email" value={f.email} onChange={set("email")} className={inputCls} data-testid="checkout-email-input" /></Field>
              <Field id="co-address" label="Address"><Textarea id="co-address" required minLength={5} value={f.address} onChange={set("address")} className={inputCls} data-testid="checkout-address-input" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field id="co-city" label="City"><Input id="co-city" required value={f.city} onChange={set("city")} className={inputCls} data-testid="checkout-city-input" /></Field>
                <Field id="co-pin" label="PIN / ZIP"><Input id="co-pin" required value={f.pincode} onChange={set("pincode")} className={inputCls} data-testid="checkout-pincode-input" /></Field>
              </div>
              {destination === "abroad" && (
                <Field id="co-country" label="Country"><Input id="co-country" required value={f.country === "India" ? "" : f.country} onChange={set("country")} className={inputCls} data-testid="checkout-country-input" /></Field>
              )}
              <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 py-3 text-sm font-bold text-[#0A0F1D] transition-transform duration-200 hover:scale-[1.02] disabled:opacity-60" data-testid="checkout-pay-button">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Pay {quote ? rupee(quote.total) : ""}
              </button>
              <p className="text-center text-xs text-slate-500">Amount is calculated on our server and verified after payment.</p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
