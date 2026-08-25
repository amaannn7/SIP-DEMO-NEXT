# Design System — Sales Intelligence System

A modern, confident dashboard language built on the brand's cyan → violet → magenta
spectrum. The old system was monochrome-by-policy: flat white, near-black primary,
color reserved only for data. That read as *pale and dull*. This system keeps the
data-tool discipline (dense, legible, no decoration for its own sake) but gives the
product a spine of real brand color, depth, and rhythm.

Reference direction: shadcn UI Kit "Project Management" dashboard — card-grid
layout, KPI tiles with delta indicators, status pills, progress bars, generous
internal padding, subtle borders over heavy shadows.

---

## 1. Brand

The brand mark is a horizontal gradient sweeping cyan → violet → magenta.

| Stop | Hex | OKLCH | Role |
| --- | --- | --- | --- |
| Cyan | `#2FE6E0` | `oklch(0.84 0.14 195)` | Gradient start, success-adjacent accents, chart-3 |
| Violet | `#7B5BF0` | `oklch(0.58 0.21 285)` | **Primary.** Buttons, active nav, focus rings, links |
| Magenta | `#C01FFF` | `oklch(0.60 0.29 320)` | Gradient end, accent, emphasis, chart-5 |

### Gradient tokens

```css
--brand-gradient: linear-gradient(100deg, #2FE6E0 0%, #7B5BF0 52%, #C01FFF 100%);
--brand-gradient-soft: linear-gradient(100deg, ...12% alpha...);
```

**Where the gradient is allowed:** the logo mark, the login art panel, the active
sidebar rail indicator, one hero/briefing surface per page, and progress-bar fills.
**Where it is not:** body text, table rows, borders, or more than one large surface
in a single viewport. The gradient is a signature, not a wallpaper.

Primary (violet) does the everyday work. Magenta is the accent for urgency and
emphasis. Cyan is the cool counterweight — it keeps the palette from reading as
purely "purple SaaS."

---

## 2. Color tokens

All tokens are OKLCH for perceptually even light/dark pairs. Light is the default;
dark mode is a full peer, not an afterthought.

### Light

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `oklch(0.985 0.003 280)` | App canvas — a hair off-white, cooled toward violet |
| `--card` | `oklch(1 0 0)` | Card/panel surface, lifts off the canvas |
| `--foreground` | `oklch(0.20 0.02 285)` | Primary text |
| `--muted-foreground` | `oklch(0.53 0.02 285)` | Secondary text, labels |
| `--primary` | `oklch(0.58 0.21 285)` | Violet — buttons, active states |
| `--accent` | `oklch(0.60 0.29 320)` | Magenta — urgency, emphasis |
| `--border` | `oklch(0.92 0.006 285)` | Hairlines |
| `--success` | `oklch(0.65 0.16 165)` | Positive deltas, complete states |
| `--warning` | `oklch(0.75 0.15 75)` | Caution |
| `--destructive` | `oklch(0.58 0.23 25)` | Errors, negative deltas |

### Dark

Dark mode is a **first-class peer of light**, matching the shadcn UI Kit: the whole
app inverts, not just the canvas.

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `oklch(0.17 0.015 285)` | Canvas — deep violet-tinted slate, never pure black |
| `--card` | `oklch(0.21 0.018 285)` | Cards lift off the canvas by lightness alone |
| `--foreground` | `oklch(0.96 0.005 285)` | Primary text |
| `--muted-foreground` | `oklch(0.68 0.015 285)` | Secondary text |
| `--primary` | `oklch(0.68 0.19 285)` | Violet lightened to stay legible on dark |
| `--border` | `oklch(0.29 0.012 285)` | Hairlines |
| `--sidebar` | `oklch(0.19 0.016 285)` | Slightly darker than cards |

Card hover shadows switch from black-based to a violet-tinted glow, since black
shadows are invisible on a dark canvas.

**Theme switching** uses `next-themes` (already a dependency) with
`attribute="class"`, `defaultTheme="system"`, and `disableTransitionOnChange` to
avoid a flash of transitioning colors. A `ThemeToggle` in the topbar cycles
light → dark → system with a sun/moon/monitor glyph.

The critical rule: **every color is defined on bare `:root` first**, then overridden
inside `.dark`. No color may have its only definition inside a theme block.

### Temperature scale (lead urgency)

Repurposed onto the brand spectrum so it reads as one family:
on-fire = magenta, hot = violet-magenta blend, warm = violet, cold = slate.

---

## 3. Typography

**Font: Outfit** for body, UI, and headings. **Geist Mono** for code/IDs.

This is verified from the reference build, not assumed. The shadcn UI Kit ships a
theme customizer offering Inter, Geist, Plus Jakarta Sans, Poppins, Montserrat,
Outfit, PT Sans, Kumbh Sans and others — but its *applied default* is Outfit:

```css
body { --text-family: var(--font-outfit), sans-serif; }
```

Outfit is a geometric sans with near-circular bowls, a tall x-height, and very even
stroke weight. That geometry is what gives the reference its modern, friendly,
"promising product" feel where the old Inter build read neutral and corporate — and
its 600/700 weights give KPI numerals real presence.

Numerals use `tabular-nums` everywhere so columns align and counters don't jitter.
Outfit's default figures are proportional, so this must be set explicitly — it is
applied globally to `th`/`td` and via a `.tnum` utility for KPI values outside
tables.

| Role | Size | Weight | Tracking |
| --- | --- | --- | --- |
| Page title | 20px | 700 | -0.02em |
| Section heading | 14px | 600 | -0.01em |
| KPI value | 30px | 700 | -0.03em |
| Body | 13–14px | 400/500 | 0 |
| Label / eyebrow | 11px | 600 | 0.04em, uppercase |
| Table numerals | 13px | 500 | tabular-nums |

Numbers everywhere use `tabular-nums` so columns align and counters don't jitter.

---

## 4. Surfaces & depth

Three elevation levels, no more:

- **Canvas** — the app background. Tinted, never pure white.
- **Card** (`.card-surface`) — `border-border`, `rounded-xl`, resting shadow of
  `0 1px 2px oklch(0 0 0 / 4%)`. On hover: shadow deepens to
  `0 8px 24px -8px`, border warms toward primary at 30% mix, and the card lifts
  `-1px`. Every card in the app moves the same way.
- **Overlay** — dialogs, popovers, dropdowns. `rounded-2xl`, stronger shadow,
  backdrop blur.

**Radius scale:** `--radius: 0.75rem`. Cards `xl` (12px), buttons/inputs `lg`
(9.6px), pills/badges fully round, overlays `2xl`.

Padding rhythm: cards `p-5`, dense cards `p-4`, page gutters `p-6`, grid gaps
`gap-4`. Vertical stack spacing `space-y-5` between page sections.

---

## 5. Components

### Sidebar
Tinted surface (`--sidebar`), not flat white — separates from canvas without a
heavy border. Logo is a gradient-filled rounded square with the company initial in
white. Nav items are pills; the **active** item gets a solid violet fill, white
text, and a soft violet glow (`0 2px 8px primary/25`). Inactive items are muted
until hover. Section eyebrows are 10px uppercase, tracked.

**Collapse** — 16rem expanded, 4.5rem collapsed, driven by one `--sidebar-w`
variable that both the sidebar's width and the content column's left padding
read, so the two move in the same paint. Three rules the first build got wrong:

1. **The trigger never moves.** It's a 24px circular button absolutely pinned to
   the sidebar's right edge, vertically aligned with the logo row, half-overlapping
   the border. Previously it sat inside the header's flex row and the header
   switched to `flex-col` when collapsed, so the button jumped below the logo —
   the control relocated as you used it.
2. **The chevron points where the panel will go**, rotating 180° on state rather
   than swapping icons.
3. **No flash on load.** The stored preference is read in the `useState`
   initializer, not an effect, and transitions stay off until a `ready` flag flips
   after mount — otherwise a collapsed sidebar visibly animated shut on every
   page load.

Collapsed, the logo stays in place and only the wordmark drops, nav labels give
way to centered icons with tooltips, section eyebrows become a short hairline
divider (dropping them outright left uneven gaps), and the active item gains a
gradient rail on its left edge since the pill fill alone is easy to miss.

### Topbar
Sticky, `backdrop-blur`, translucent background so content scrolls under it. Page
title at 20px/700. Search field is a rounded-full muted pill that expands its ring
on focus. Notification bell sits in an icon-button.

### Stat / KPI tile
The workhorse. Structure: a colored icon chip (tinted background, colored glyph),
label, then a large tabular value, then an optional **delta pill** (green ▲ /
red ▼ with a percentage) and hint text. Icon chip color is driven by the tile's
`accent` prop — primary/accent/success/warning — which is what brings life to the
dashboard grid.

### Progress card
KPI value + `done / target`, a rounded-full track with a **gradient fill** at the
completion percentage, switching to solid success green when complete.

### Buttons
- `default` — solid violet, white text, subtle shadow, darkens on hover.
- `brand` — the gradient fill. Reserved for the single most important action on a
  screen (Sign in, Add Lead).
- `outline` / `ghost` / `secondary` — neutral, for everything else.
Heights: 36px default, 32px sm, 40px lg.

### Badges & pills
Fully rounded, `px-2.5`, 11px/600. Semantic variants use a 12% tint of their hue
as background with the full hue as text — never solid fills for status, so a table
full of badges doesn't turn into a color riot.

### Tables
Header row: muted background, 11px uppercase tracked labels, sticky. Rows:
`border-b` hairline, hover tints to `muted/60`, numerics tabular. Row height 52px
for comfortable scanning.

### Login
Split screen, 50/50 on `lg`, single column below.
- **Left** — the form on card surface. Gradient logo mark, 28px/700 "Welcome back",
  muted subtitle, floating-label-style inputs with leading icons, gradient submit
  button.
- **Right** — the brand art panel: full-bleed brand gradient, layered with soft
  radial blooms and a subtle grid, a headline in white, and a testimonial/stat card
  in frosted glass (`backdrop-blur`, white/12 fill, white/20 border).
Inputs are 44px tall here (larger than in-app) — auth screens get more air.

---

## 6. Motion

Fast and understated. `150ms ease` for color/background, `200ms ease-out` for
transform and shadow. Cards lift 1px on hover. Nav pills have no transform, only
color. Nothing bounces, nothing spins except genuine loading states.

Respect `prefers-reduced-motion`: transforms are dropped, color transitions stay.

---

## 7. Rules

1. Gradient appears **at most twice** per viewport, and never behind body copy.
2. Color must carry meaning — status, delta direction, temperature, or brand
   identity. Never decorative-only fills on data surfaces.
3. Every semantic color has a light *and* dark value on `:root` / `.dark`.
4. All numeric displays use `tabular-nums`.
5. Cards share one depth language via `.card-surface` — no per-component shadows.
6. Contrast floor: 4.5:1 for body text, 3:1 for large text and UI glyphs. White on
   violet passes; white on cyan does **not** — cyan never carries white text.
