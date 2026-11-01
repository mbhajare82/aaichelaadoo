import { useEffect, useState } from "react";
import { Quote } from "lucide-react";
import { http } from "@/lib/api";
import { SectionTitle } from "./SectionTitle";
import { Stars } from "./Stars";

export const Testimonials = () => {
  const [list, setList] = useState([]);
  useEffect(() => {
    http.get("/testimonials").then(({ data }) => setList(data)).catch(() => setList([]));
  }, []);
  return (
    <section id="testimonials" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" data-testid="testimonials-section">
      <SectionTitle label="Testimonials" title="What our customers say" />
      {list.length === 0 ? (
        <p className="text-slate-400" data-testid="testimonials-empty">Customer reviews will appear here soon.</p>
      ) : (
        <div className="columns-1 gap-6 sm:columns-2 lg:columns-3">
          {list.map((t) => (
            <figure key={t.id} className="mb-6 break-inside-avoid rounded-2xl border border-slate-700 bg-[#1E293B] p-6" data-testid={`testimonial-${t.id}`}>
              <Quote className="h-6 w-6 text-amber-500/60" />
              <blockquote className="mt-3 text-sm leading-relaxed text-slate-200">{t.comment}</blockquote>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-slate-400">
                {[["Taste", t.taste], ["Price", t.price], ["Nourishment", t.nourishment]].map(([l, v]) => (
                  <div key={l}><p>{l}</p><Stars value={v} /></div>
                ))}
              </div>
              <figcaption className="mt-4 text-sm font-semibold text-amber-400">— {t.name}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
};
