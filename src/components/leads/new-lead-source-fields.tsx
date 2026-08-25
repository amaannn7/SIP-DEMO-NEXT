const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10";
const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";

const SOURCE_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "inbound", label: "Inbound" },
  { value: "import", label: "Import" },
  { value: "other", label: "Other" },
];

// A limited subset of stages, not the full pipeline — matches the source
// system's "use source default" (blank) plus a few sensible starting
// points for a lead someone already made contact with before entering it.
const INITIAL_STAGE_OPTIONS = [
  { value: "", label: "Use source default" },
  { value: "research", label: "Research" },
  { value: "call_attempted", label: "Call Attempted" },
  { value: "engaged", label: "Engaged" },
];

export function NewLeadSourceFields() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className={labelClass} htmlFor="source">
          Lead source
        </label>
        <select id="source" name="source" defaultValue="manual" className={inputClass}>
          {SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor="stage">
          Initial stage
        </label>
        <select id="stage" name="stage" defaultValue="" className={inputClass}>
          {INITIAL_STAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor="sourceDetail">
          Source detail
        </label>
        <input
          id="sourceDetail"
          name="sourceDetail"
          placeholder="e.g. Trade show, April 2026"
          className={inputClass}
        />
      </div>
    </div>
  );
}
