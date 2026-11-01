import { Star } from "lucide-react";

export const Stars = ({ value, onChange, testid }) => (
  <div className="flex gap-1" data-testid={testid}>
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        type="button" key={n} disabled={!onChange} onClick={() => onChange?.(n)}
        className="transition-transform duration-150 enabled:hover:scale-110"
        data-testid={testid ? `${testid}-${n}` : undefined}
      >
        <Star className={`h-4 w-4 ${n <= value ? "fill-amber-400 text-amber-400" : "text-slate-600"}`} />
      </button>
    ))}
  </div>
);
