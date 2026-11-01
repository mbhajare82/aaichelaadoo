import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { http, errMsg } from "@/lib/api";

export default function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await http.post("/auth/login", { email, password });
      localStorage.setItem("al_token", data.token);
      nav("/admin");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid-paper grid min-h-screen place-items-center px-4" data-testid="admin-login-page">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-3xl border border-amber-500/25 bg-slate-900/80 p-8 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-amber-400"><Lock className="h-5 w-5" /><span className="font-cinzel text-xl font-bold">AAICHELADOO Admin</span></div>
        <Input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="border-slate-600 bg-slate-950 text-slate-100" data-testid="admin-email-input" />
        <Input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="border-slate-600 bg-slate-950 text-slate-100" data-testid="admin-password-input" />
        {error && <p className="text-sm text-red-400" data-testid="admin-login-error">{error}</p>}
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 py-3 text-sm font-bold text-[#0A0F1D] transition-transform duration-200 hover:scale-[1.02] disabled:opacity-60" data-testid="admin-login-submit">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
        </button>
      </form>
    </div>
  );
}
