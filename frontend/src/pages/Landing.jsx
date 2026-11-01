import { useCallback, useEffect, useState } from "react";
import { http } from "@/lib/api";
import { Header } from "@/components/site/Header";
import { Hero } from "@/components/site/Hero";
import { CatalogSection } from "@/components/site/CatalogSection";
import { ComboSection } from "@/components/site/ComboSection";
import { CartSheet } from "@/components/site/CartSheet";
import { FeedbackSection } from "@/components/site/FeedbackSection";
import { Testimonials } from "@/components/site/Testimonials";
import { Footer } from "@/components/site/Footer";
import { LaadoChat } from "@/components/site/LaadoChat";
import { CountdownBanner } from "@/components/site/CountdownBanner";

export default function Landing() {
  const [catalog, setCatalog] = useState({ products: [], combos: [], settings: null });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await http.get("/catalog");
      setCatalog(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="grid-paper grain relative min-h-screen text-slate-100" data-testid="landing-page">
      <CountdownBanner />
      <Header />
      <main className="relative z-10">
        <Hero settings={catalog.settings} />
        <ComboSection combos={catalog.combos} loading={loading} />
        <CatalogSection products={catalog.products} loading={loading} />
        <FeedbackSection />
        <Testimonials />
      </main>
      <Footer />
      <CartSheet settings={catalog.settings} onOrderPaid={load} />
      <LaadoChat />
    </div>
  );
}
