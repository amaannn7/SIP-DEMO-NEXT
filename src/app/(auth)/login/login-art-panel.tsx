/**
 * Right-hand panel for the split auth card — permanently dark, independent
 * of the app's light/dark mode toggle (the light-left/dark-right split is
 * the design itself, matching the reference, not a themeable surface).
 * Colors here are deliberately literal, not design tokens, for that reason.
 *
 * Concentric ring outlines over a soft violet/cyan glow — the original
 * background treatment for this panel, with more rings added across the
 * whole canvas (same plain white-border style throughout, no tinting). No
 * mock UI, no diagram of "the product," no fabricated customer
 * attribution — just the rings and the message.
 */
export function LoginArtPanel() {
  return (
    <div className="relative hidden h-full flex-col overflow-hidden bg-[oklch(0.16_0.02_285)] lg:flex">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-24 -right-24 size-[28rem] rounded-full border border-white/[0.06]" />
        <div className="absolute top-1/3 -right-40 size-[36rem] rounded-full border border-white/[0.05]" />
        <div className="absolute -bottom-32 -left-16 size-[22rem] rounded-full border border-white/[0.05]" />
        <div className="absolute -top-40 -left-32 size-[24rem] rounded-full border border-white/[0.04]" />
        <div className="absolute top-[6%] right-[8%] size-[14rem] rounded-full border border-white/[0.07]" />
        <div className="absolute bottom-[10%] right-[-6%] size-[20rem] rounded-full border border-white/[0.05]" />
        <div className="absolute top-[42%] left-[2%] size-[10rem] rounded-full border border-white/[0.06]" />
        <div className="absolute -bottom-16 left-[30%] size-[16rem] rounded-full border border-white/[0.04]" />
        <div className="brand-gradient-soft absolute top-1/4 left-1/4 size-[26rem] rounded-full opacity-30 blur-3xl" />
      </div>

      <div className="relative flex flex-1 flex-col justify-center px-16">
        <p className="text-xs font-semibold tracking-[0.2em] text-white/40 uppercase">Sales intelligence CRM</p>
        <h2 className="mt-4 max-w-md text-[34px] leading-[1.15] font-semibold tracking-tight text-white">
          One workspace for the whole pipeline.
        </h2>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/60">
          Leads, calls, email, and your team&rsquo;s activity, always in sync.
        </p>
      </div>
    </div>
  );
}
