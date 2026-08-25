import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Each color is darkened just enough (same hue/saturation, lower lightness)
// that white initials on top meet WCAG AA (4.5:1) — the original values
// (particularly the green and yellow, ~1.7:1) left initials essentially
// unreadable against the white AvatarFallback text.
const PALETTE = ["#d64124", "#2a6df7", "#1f845c", "#916e06", "#945fb9", "#bf5500"];

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function UserAvatar({
  name,
  avatarUrl,
  size = "default",
  isOnline,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "default" | "lg";
  /** Omit to render no presence dot at all (unknown/not applicable). */
  isOnline?: boolean;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar size={size}>
        {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
        <AvatarFallback className="font-semibold text-white" style={{ backgroundColor: colorFor(name) }}>
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      {isOnline !== undefined && (
        <span
          className={cn(
            "absolute right-0 bottom-0 rounded-full ring-2 ring-card",
            size === "sm" ? "size-2" : "size-2.5",
            isOnline ? "bg-success" : "bg-muted-foreground/40",
          )}
          aria-label={isOnline ? "Online" : "Offline"}
        />
      )}
    </span>
  );
}
