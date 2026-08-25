/**
 * Circular fit-score indicator. Was a flat bordered circle whose ring carried
 * no information; now the ring itself fills to the score via a conic gradient,
 * so the number and the arc say the same thing. Tier drives the hue: green for
 * a strong fit, amber mid, muted low.
 */
export function ScoreRing({ score, size = 36 }: { score: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const tone =
    clamped >= 85 ? "var(--success)" : clamped >= 65 ? "var(--warning)" : "var(--muted-foreground)";

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Fit score ${clamped} out of 100`}
    >
      {/* Filled arc, masked to a 3px ring by the inset card-colored disc below. */}
      <div
        className="size-full rounded-full"
        style={{
          background: `conic-gradient(${tone} ${clamped * 3.6}deg, color-mix(in oklch, var(--muted-foreground) 18%, transparent) 0deg)`,
        }}
      />
      <div className="absolute inset-[3px] flex items-center justify-center rounded-full bg-card">
        <span className="tnum text-[11px] font-bold" style={{ color: tone }}>
          {clamped}
        </span>
      </div>
    </div>
  );
}
