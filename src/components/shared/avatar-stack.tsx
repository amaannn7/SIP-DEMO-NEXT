import { cn } from "@/lib/utils";

export function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max);
  const overflow = names.length - shown.length;

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((name, i) => {
        const initials = name
          .split(" ")
          .map((p) => p[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();
        return (
          <div
            key={name + i}
            className="flex size-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[9px] font-semibold text-muted-foreground"
            title={name}
          >
            {initials}
          </div>
        );
      })}
      {overflow > 0 && (
        <div
          className={cn(
            "flex size-6 items-center justify-center rounded-full border-2 border-background text-[9px] font-semibold text-white",
          )}
          style={{ background: "var(--primary)" }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
