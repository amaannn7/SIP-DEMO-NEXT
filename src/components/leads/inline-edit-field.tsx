"use client";

import { useRef, useState, useTransition } from "react";
import { Pencil, Check, X } from "lucide-react";
import { updateLeadAction } from "@/app/(dashboard)/leads/actions";

/**
 * A label/value row that flips into a single-field input on hover-pencil
 * click, saves via updateLeadAction with only this one field in the
 * FormData (parseLeadForm only reads keys actually present, so the rest of
 * the lead is left untouched), and reverts to display mode on success.
 */
export function InlineEditField({
  leadId,
  field,
  label,
  value,
  type = "text",
  href,
  displayValue,
  multiline = false,
}: {
  leadId: string;
  field: string;
  label: string;
  value: string | null;
  type?: "text" | "email" | "tel" | "url";
  href?: (value: string) => string;
  /** Ports the source system's trimmed link text (e.g. LinkedIn/website URLs
   * shown as just the username/domain while the href keeps the full URL) —
   * defaults to the raw stored value when not provided. */
  displayValue?: (value: string) => string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function save() {
    const newValue = (multiline ? textareaRef.current?.value : inputRef.current?.value) ?? "";
    const formData = new FormData();
    formData.set(field, newValue);
    startTransition(async () => {
      const result = await updateLeadAction(leadId, {}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className={multiline ? "mt-0.5 space-y-1.5" : "mt-0.5 flex items-center gap-1.5"}>
          {multiline ? (
            <textarea
              ref={textareaRef}
              defaultValue={value ?? ""}
              autoFocus
              disabled={isPending}
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditing(false);
              }}
              className="w-full resize-none rounded-md border border-[var(--primary)] bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-[var(--primary)]/10"
            />
          ) : (
            <input
              ref={inputRef}
              type={type}
              defaultValue={value ?? ""}
              autoFocus
              disabled={isPending}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
              className="h-7 min-w-0 flex-1 rounded-md border border-[var(--primary)] bg-background px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-[var(--primary)]/10"
            />
          )}
          <div className={multiline ? "flex items-center gap-1.5" : "contents"}>
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-success hover:bg-success/10 disabled:opacity-50"
              aria-label="Save"
            >
              <Check className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={isPending}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-50"
              aria-label="Cancel"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="group/field">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className={multiline ? "mt-0.5 flex items-start gap-1.5" : "mt-0.5 flex items-center gap-1.5"}>
        {value ? (
          href ? (
            <a href={href(value)} className="text-sm text-[var(--accent)] hover:underline">
              {displayValue ? displayValue(value) : value}
            </a>
          ) : (
            <span className={multiline ? "whitespace-pre-wrap text-sm text-foreground" : "text-sm text-foreground"}>{value}</span>
          )
        ) : (
          <span className="text-sm text-muted-foreground">Not set</span>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/field:opacity-100"
          aria-label={`Edit ${label}`}
        >
          <Pencil className="size-3" />
        </button>
      </div>
    </div>
  );
}
