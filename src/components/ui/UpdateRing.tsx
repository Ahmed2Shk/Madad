/**
 * PH-02: how many listed medicines are up to date, as a ring that fills smoothly as the staff update
 * them. The count comes from the caller (freshness via src/lib/freshness.ts); the text beside the
 * ring says the same thing for screen readers, so the ring itself is decorative.
 */
export function UpdateRing({ done, total, label }: { done: number; total: number; label: string }) {
  const r = 22;
  const length = 2 * Math.PI * r;
  const share = total > 0 ? done / total : 0;
  const complete = total > 0 && done >= total;
  return (
    <div className="flex items-center gap-3">
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden className="shrink-0 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" className="stroke-border" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - share)}
          className={complete ? 'stroke-ok-icon transition-[stroke-dashoffset] duration-700 ease-soft' : 'stroke-primary transition-[stroke-dashoffset] duration-700 ease-soft'}
        />
      </svg>
      <p className="text-meta font-medium text-ink">{label}</p>
    </div>
  );
}
