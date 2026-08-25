import Link from "next/link";
import { Flame, Sun, CloudSun, Snowflake, ArrowUpRight } from "lucide-react";
import type { TemperatureCounts } from "@/lib/db/queries/today-dashboard";

// Each tile is keyed to its temperature token, so the urgency scale reads as
// one family down the brand spectrum: magenta (hottest) -> violet -> slate.
const TILES: {
  key: keyof TemperatureCounts;
  label: string;
  icon: typeof Flame;
  token: string;
}[] = [
  { key: "on_fire", label: "Priority", icon: Flame, token: "var(--temp-on-fire)" },
  { key: "hot", label: "Hot", icon: Sun, token: "var(--temp-hot)" },
  { key: "warm", label: "Warm", icon: CloudSun, token: "var(--temp-warm)" },
  { key: "cold", label: "Cold", icon: Snowflake, token: "var(--temp-cold)" },
];

export function TemperatureTiles({ counts }: { counts: TemperatureCounts }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {TILES.map((tile) => (
        <Link key={tile.key} href={`/leads?temperature=${tile.key}`} className="group block">
          <div className="card-surface relative overflow-hidden rounded-xl border border-border bg-card p-5">
            {/* Colored top edge — a quiet, one-pixel signal of where this tile
                sits on the urgency scale, readable even at a glance. */}
            <span
              className="absolute inset-x-0 top-0 h-1"
              style={{ background: tile.token }}
              aria-hidden
            />
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-medium text-muted-foreground">{tile.label}</p>
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: `color-mix(in oklch, ${tile.token} 14%, transparent)`,
                  color: tile.token,
                }}
              >
                <tile.icon className="size-4" strokeWidth={2} />
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between gap-2">
              <p className="tnum text-3xl font-bold tracking-tight text-foreground">{counts[tile.key]}</p>
              <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">View leads</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
