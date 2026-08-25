"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Upload, Check, AlertTriangle } from "lucide-react";
import {
  IMPORT_TARGET_FIELDS,
  IMPORT_TARGET_LABELS,
  applyColumnMapping,
  guessFieldForHeader,
  type ImportColumnMapping,
  type ImportTargetField,
} from "@/lib/validation/csv-field-map";
import { parseSpreadsheetFile } from "@/lib/validation/spreadsheet-parse";
import { validateRow } from "@/lib/validation/csv-import";

type ImportResult = {
  imported: number;
  skipped: number;
  invalid: number;
  duplicates?: string[];
  invalidRows?: { row: string; issues: string[] }[];
};

const ROW_ISSUE_LABELS: Record<string, string> = {
  invalid_email: "Invalid email format",
  no_identifying_data: "No name, company, email, or phone",
};

type Step = "upload" | "mapping" | "result";

const SOURCE_OPTIONS = [
  { value: "import", label: "Import" },
  { value: "inbound", label: "Inbound" },
  { value: "manual", label: "Manual" },
  { value: "other", label: "Other" },
];

export function ImportForm() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ImportColumnMapping>({});
  const [source, setSource] = useState("import");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleFileChosen(chosen: File | null) {
    setFile(chosen);
    setError(null);
    if (!chosen) return;

    parseSpreadsheetFile(chosen)
      .then(({ headers: detectedHeaders, rows }) => {
        if (detectedHeaders.length === 0) {
          setError("Could not detect any columns in this file");
          return;
        }
        const autoMapping: ImportColumnMapping = {};
        for (const header of detectedHeaders) {
          autoMapping[header] = guessFieldForHeader(header) ?? "";
        }
        setHeaders(detectedHeaders);
        setMapping(autoMapping);
        setAllRows(rows);
        setStep("mapping");
      })
      .catch(() => setError("Could not read this file. Make sure it's a valid CSV or .xlsx file."));
  }

  async function handleImport() {
    if (!file) return;
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("skip_duplicates", String(skipDuplicates));
    formData.append("mapping", JSON.stringify(mapping));
    formData.append("source", source);

    try {
      const res = await fetch("/api/leads/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Import failed");
        return;
      }
      setResult(data);
      setStep("result");
      router.refresh();
    } catch {
      setError("Import failed. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setAllRows([]);
    setMapping({});
    setResult(null);
    setError(null);
  }

  // Recomputed live as the user adjusts the mapping — lets them fix a
  // column assignment and immediately see the invalid-row count drop,
  // rather than only discovering issues after committing the import.
  const validationSummary = useMemo(() => {
    let valid = 0;
    let invalid = 0;
    const sample: { row: string; issues: string[] }[] = [];
    for (const row of allRows) {
      const mapped = applyColumnMapping(row, mapping) as Record<ImportTargetField, string>;
      const { ok, issues } = validateRow(mapped);
      if (ok) {
        valid++;
      } else {
        invalid++;
        if (sample.length < 5) {
          const label = [mapped.firstName, mapped.lastName].filter(Boolean).join(" ") || mapped.email || mapped.company || "(unlabeled row)";
          sample.push({ row: label, issues });
        }
      }
    }
    return { valid, invalid, sample };
  }, [allRows, mapping]);

  const sampleRows = allRows.slice(0, 3);
  const rowCount = allRows.length;

  if (step === "result" && result) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-success/10 px-3 py-2 text-xs text-success">
          Imported {result.imported} lead{result.imported === 1 ? "" : "s"}
          {result.skipped > 0 ? `, skipped ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"}` : ""}
          {result.invalid > 0 ? `, ${result.invalid} row${result.invalid === 1 ? "" : "s"} couldn't be imported` : ""}.
        </div>

        {result.invalidRows && result.invalidRows.length > 0 && (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
            <p className="mb-1.5 text-xs font-medium text-destructive">
              {result.invalid} row{result.invalid === 1 ? "" : "s"} skipped — here{result.invalidRows.length < result.invalid ? "'s the first " + result.invalidRows.length : " they are"}:
            </p>
            <ul className="space-y-1 text-xs text-foreground">
              {result.invalidRows.map((r, i) => (
                <li key={i} className="flex items-baseline gap-1.5">
                  <span className="font-medium">{r.row}</span>
                  <span className="text-muted-foreground">
                    — {r.issues.map((issue) => ROW_ISSUE_LABELS[issue] ?? issue).join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={reset}
          className="h-9 rounded-md border border-input px-4 text-sm font-medium text-foreground hover:bg-muted"
        >
          Import another file
        </button>
      </div>
    );
  }

  if (step === "mapping") {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="mb-1 text-[15px] font-semibold tracking-tight text-foreground">Map columns</h3>
          <p className="text-xs text-muted-foreground">
            {rowCount} row{rowCount === 1 ? "" : "s"} detected. Confirm which column maps to which field, or skip a column.
          </p>
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-medium text-muted-foreground">
                <th className="px-3 py-2">CSV column</th>
                <th className="px-3 py-2">Sample</th>
                <th className="px-3 py-2">Maps to</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {headers.map((header) => (
                <tr key={header}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      {mapping[header] && <Check className="size-3 text-success" />}
                      {header}
                    </div>
                  </td>
                  <td className="max-w-40 truncate px-3 py-2 text-muted-foreground">
                    {sampleRows.map((row) => row[header]).filter(Boolean).slice(0, 1).join(", ") || "–"}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={mapping[header] ?? ""}
                      onChange={(e) =>
                        setMapping((prev) => ({ ...prev, [header]: e.target.value as ImportTargetField | "" }))
                      }
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-[var(--primary)]"
                    >
                      <option value="">Skip</option>
                      {IMPORT_TARGET_FIELDS.map((field) => (
                        <option key={field} value={field}>
                          {IMPORT_TARGET_LABELS[field]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          className={`rounded-md px-3 py-2 text-xs ${
            validationSummary.invalid > 0 ? "bg-warning/10 text-warning-foreground" : "bg-success/10 text-success"
          }`}
        >
          <p className="flex items-center gap-1.5 font-medium">
            {validationSummary.invalid > 0 && <AlertTriangle className="size-3.5 shrink-0" />}
            {validationSummary.valid} row{validationSummary.valid === 1 ? "" : "s"} ready to import
            {validationSummary.invalid > 0 &&
              `, ${validationSummary.invalid} will be skipped (invalid email, or missing name/company/email/phone)`}
            .
          </p>
          {validationSummary.sample.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
              {validationSummary.sample.map((r, i) => (
                <li key={i}>
                  <span className="font-medium text-foreground">{r.row}</span> — {r.issues.map((issue) => ROW_ISSUE_LABELS[issue] ?? issue).join(", ")}
                </li>
              ))}
              {validationSummary.invalid > validationSummary.sample.length && (
                <li>…and {validationSummary.invalid - validationSummary.sample.length} more</li>
              )}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="import-source">
              Source for this batch
            </label>
            <select
              id="import-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-[var(--primary)]"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 pt-4 text-sm text-foreground">
            <input
              type="checkbox"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
              className="size-4 rounded border-input"
            />
            Skip duplicates (by email)
          </label>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleImport}
            disabled={isSubmitting || validationSummary.valid === 0}
            className="flex h-9 items-center rounded-md px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "var(--primary)" }}
          >
            {isSubmitting
              ? "Importing…"
              : `Import ${validationSummary.valid} lead${validationSummary.valid === 1 ? "" : "s"}`}
          </button>
          <button type="button" onClick={reset} className="h-9 rounded-md border border-input px-4 text-sm text-foreground hover:bg-muted">
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="csv-file">
          Leads file
        </label>
        <div
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border px-4 py-8 text-center transition-colors hover:border-[var(--primary)]"
        >
          <Upload className="mb-2 size-5 text-muted-foreground" />
          <p className="text-sm text-foreground">{file ? file.name : "Click to choose a CSV or .xlsx file"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Accepts CSV and Excel exports — Zoho, Firmable, Apollo, and other CRM/list formats</p>
        </div>
        <input
          ref={inputRef}
          id="csv-file"
          type="file"
          accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => handleFileChosen(e.target.files?.[0] ?? null)}
        />
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
