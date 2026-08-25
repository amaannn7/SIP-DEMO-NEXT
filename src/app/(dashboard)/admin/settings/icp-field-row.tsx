"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Star, Trash2, TriangleAlert } from "lucide-react";
import type { icpFields } from "@/lib/db/schema";
import { updateIcpFieldWeightAction, updateIcpOptionFlagAction, toggleIcpFieldEnabledAction, deleteIcpFieldAction } from "./icp-actions";

type IcpFieldRowData = typeof icpFields.$inferSelect;

export function IcpFieldRow({ field }: { field: IcpFieldRowData }) {
  const [weight, setWeight] = useState(field.weight);
  const [showOptions, setShowOptions] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(() => toggleIcpFieldEnabledAction(field.id, !field.isEnabled));
  }

  function handleDelete() {
    if (!confirm(`Delete "${field.label}"? Any lead answers already saved for it are kept but will no longer show.`)) return;
    startTransition(() => deleteIcpFieldAction(field.id));
  }

  const hasOptions = field.options && field.options.length > 0;

  return (
    <div className={field.isEnabled ? "" : "opacity-50"}>
      <div className="flex items-center gap-4 py-3">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          title={field.isEnabled ? "Disable this question" : "Enable this question"}
          className={`h-5 w-9 shrink-0 rounded-full transition-colors ${field.isEnabled ? "bg-[var(--primary)]" : "bg-muted"}`}
        >
          <span
            className={`block size-4 rounded-full bg-white shadow transition-transform ${field.isEnabled ? "translate-x-4" : "translate-x-0.5"}`}
          />
        </button>

        <button
          type="button"
          onClick={() => hasOptions && setShowOptions((v) => !v)}
          disabled={!hasOptions}
          className="min-w-0 flex-1 text-left disabled:cursor-default"
        >
          <p className="flex items-center gap-1 text-sm font-medium text-foreground">
            {hasOptions && (showOptions ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />)}
            {field.label}
          </p>
          {field.subtitle && <p className="truncate text-xs text-muted-foreground">{field.subtitle}</p>}
          <p className="text-xs text-muted-foreground">
            {field.fieldType}
            {hasOptions ? ` · ${field.options!.length} options` : ""}
          </p>
        </button>
        <form
          action={(formData) => startTransition(() => updateIcpFieldWeightAction(field.id, formData))}
          className="flex items-center gap-2"
        >
          <input
            type="number"
            name="weight"
            min={0}
            max={100}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="h-8 w-16 rounded-md border border-input bg-background px-2 text-right text-sm outline-none focus:border-[var(--primary)]"
          />
          <button
            type="submit"
            disabled={isPending}
            className="h-8 rounded-md border border-input px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </form>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-60"
          title="Delete question"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {showOptions && hasOptions && (
        <div className="mb-3 ml-13 space-y-1 rounded-md border border-border bg-muted/30 p-2">
          {field.options!.map((option) => (
            <div key={option.value} className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-xs">
              <span className="min-w-0 truncate text-foreground">{option.label}</span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(() => updateIcpOptionFlagAction(field.id, option.value, "isIdeal", !option.isIdeal))
                  }
                  title={option.isIdeal ? "Unmark as ideal answer" : "Mark as ideal answer"}
                  className={`flex h-6 items-center gap-1 rounded px-1.5 transition-colors ${
                    option.isIdeal ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Star className="size-3" fill={option.isIdeal ? "currentColor" : "none"} />
                  Ideal
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(() =>
                      updateIcpOptionFlagAction(field.id, option.value, "isDisqualifying", !option.isDisqualifying),
                    )
                  }
                  title={option.isDisqualifying ? "Unmark as disqualifying" : "Mark this answer as an automatic disqualifier"}
                  className={`flex h-6 items-center gap-1 rounded px-1.5 transition-colors ${
                    option.isDisqualifying ? "bg-destructive/15 text-destructive" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <TriangleAlert className="size-3" />
                  Disqualifies
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
