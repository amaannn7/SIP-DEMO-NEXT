import { UserCog } from "lucide-react";
import { stopImpersonationAction } from "@/app/(dashboard)/actions";

export function ImpersonationBanner({ adminName }: { adminName: string }) {
  return (
    <div className="mx-2 mb-3 rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/8 p-2.5">
      <div className="flex items-start gap-2">
        <UserCog className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-foreground">Viewing as this user</p>
          <p className="truncate text-[11px] text-muted-foreground">Impersonated by {adminName}</p>
        </div>
      </div>
      <form action={stopImpersonationAction} className="mt-2">
        <button
          type="submit"
          className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
        >
          Stop impersonating
        </button>
      </form>
    </div>
  );
}
