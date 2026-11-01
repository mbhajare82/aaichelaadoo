import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { http } from "@/lib/api";
import { StatsCards } from "@/components/admin/StatsCards";
import { LeadsPanel } from "@/components/admin/LeadsPanel";
import { ProductsPanel } from "@/components/admin/ProductsPanel";
import { CombosPanel } from "@/components/admin/CombosPanel";
import { OrdersPanel } from "@/components/admin/OrdersPanel";
import { TestimonialsPanel } from "@/components/admin/TestimonialsPanel";
import { SettingsPanel } from "@/components/admin/SettingsPanel";

const tabs = [
  ["leads", "Leads", LeadsPanel],
  ["products", "Items & stock", ProductsPanel],
  ["combos", "Combos", CombosPanel],
  ["orders", "Orders", OrdersPanel],
  ["testimonials", "Testimonials", TestimonialsPanel],
  ["settings", "Delivery", SettingsPanel],
];

export default function AdminDashboard() {
  const nav = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    http.get("/auth/me").then(({ data }) => setUser(data)).catch(() => nav("/admin/login"));
  }, [nav]);

  const logout = async () => {
    await http.post("/auth/logout").catch(() => {});
    localStorage.removeItem("al_token");
    nav("/admin/login");
  };

  if (!user) return <div className="grid-paper grid min-h-screen place-items-center text-slate-400">Loading…</div>;

  return (
    <div className="grid-paper min-h-screen text-slate-100" data-testid="admin-dashboard">
      <header className="sticky top-0 z-30 border-b border-amber-500/15 bg-[#0A0F1D]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="font-cinzel text-lg font-bold text-amber-400" data-testid="admin-home-link">AAICHELADOO · Admin</Link>
          <button onClick={logout} className="flex items-center gap-1.5 rounded-full border border-slate-600 px-3 py-1.5 text-xs hover:border-amber-400" data-testid="admin-logout-button">
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <StatsCards />
        <Tabs defaultValue="leads">
          <TabsList className="no-scrollbar flex h-auto w-full justify-start gap-1 overflow-x-auto bg-slate-900 p-1">
            {tabs.map(([k, l]) => (
              <TabsTrigger key={k} value={k} className="shrink-0 rounded-md data-[state=active]:bg-amber-500 data-[state=active]:text-[#0A0F1D]" data-testid={`admin-tab-${k}`}>{l}</TabsTrigger>
            ))}
          </TabsList>
          {tabs.map(([k, , Panel]) => (
            <TabsContent key={k} value={k} className="mt-6"><Panel /></TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
