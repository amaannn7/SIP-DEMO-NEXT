"use client";

import { useState } from "react";
import { ClipboardCopy, Check } from "lucide-react";
import type { callPitches } from "@/lib/db/schema";
import { formatDate } from "@/lib/format-date";
import { stripMarkdownEmphasis } from "@/lib/ai/prompts/shared";
import { StartCallButton } from "./start-call-button";

type CallPitchRow = typeof callPitches.$inferSelect;

// Matches the numbered section headers the call-pitch prompt asks the model
// to use (buildCallPitchPrompt) — parsed out so each section gets its own
// small heading instead of one long unbroken block of text. The prompt asks
// for "clear section headers" without dictating a format, so the model is
// free to wrap them in markdown bold (**OPENING**) — matched here and
// stripped from both the header and the body, since the same markdown shows
// up mid-sentence too (e.g. "**No interest:**" inside Graceful Exit).
const SECTION_HEADERS = ["OPENING", "REASON FOR CALL", "WHO WE ARE", "PAIN POINTS", "THE ASK", "GRACEFUL EXIT"];

function parseSections(script: string): { title: string; body: string }[] {
  const pattern = new RegExp(`^\\s*\\d*\\.?\\s*\\**(${SECTION_HEADERS.join("|")})\\**\\s*[:—-]?\\s*$`, "gim");
  const matches = [...script.matchAll(pattern)];
  if (matches.length === 0) return [{ title: "", body: stripMarkdownEmphasis(script) }];

  const sections: { title: string; body: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : script.length;
    sections.push({ title: matches[i][1], body: stripMarkdownEmphasis(script.slice(start, end).trim()) });
  }
  return sections;
}

// A branch line ("- If not interested: ...") or a jump instruction ("-> Jump
// to GRACEFUL EXIT") needs to read as call-navigation, not as more script —
// a rep scanning mid-call has to spot these at a glance, not read every line
// the same weight. The model's exact punctuation varies (colon vs en-dash,
// arrow at the start vs after the "If" clause), so these match loosely
// rather than pinning one exact format.
const BRANCH_LINE = /^\s*[-•]?\s*if\b/i;
const JUMP_LINE = /(->|→)\s*(jump|end of script|skip)/i;

function renderBody(body: string) {
  return body.split("\n").map((line, i) => {
    if (BRANCH_LINE.test(line)) {
      return (
        <p key={i} className="mt-2 text-[12px] font-semibold text-[var(--accent)] first:mt-0">
          {line.trim()}
        </p>
      );
    }
    if (JUMP_LINE.test(line)) {
      return (
        <p key={i} className="text-[12px] italic text-muted-foreground">
          {line.trim()}
        </p>
      );
    }
    if (!line.trim()) return null;
    return (
      <p key={i} className="text-[14px] leading-relaxed text-foreground">
        {line}
      </p>
    );
  });
}

export function CallPitchesPanel({
  leadId,
  pitches,
  onCallStarted,
}: {
  leadId: string;
  pitches: CallPitchRow[];
  onCallStarted: () => void;
}) {
  if (pitches.length === 0) return null;

  return (
    <div className="card-surface rounded-xl border border-border bg-card p-5">
      <h3 className="mb-3 text-[15px] font-semibold tracking-tight text-foreground">Call pitches</h3>
      <div className="space-y-3">
        {pitches.map((pitch) => (
          <CallPitchCard key={pitch.id} leadId={leadId} pitch={pitch} onCallStarted={onCallStarted} />
        ))}
      </div>
    </div>
  );
}

function CallPitchCard({
  leadId,
  pitch,
  onCallStarted,
}: {
  leadId: string;
  pitch: CallPitchRow;
  onCallStarted: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const sections = parseSections(pitch.script);

  function copy() {
    navigator.clipboard.writeText(pitch.script).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{pitch.title}</span>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{formatDate(new Date(pitch.createdAt))}</span>
          <button
            type="button"
            onClick={copy}
            className="flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
          >
            {copied ? <Check className="size-3 text-success" /> : <ClipboardCopy className="size-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          {/* Just the manual "I'm calling now" declaration here — the real
              click-to-dial action lives once, prominently, in AircallBlock at
              the top of the tab, so this row doesn't duplicate it per card. */}
          <StartCallButton leadId={leadId} onStarted={onCallStarted} />
        </div>
      </div>

      <div className="space-y-2.5">
        {sections.map((section, i) => (
          <div key={`${section.title}-${i}`} className="rounded-md bg-muted/40 p-3">
            {section.title && (
              <h4 className="mb-1 text-[10px] font-bold tracking-wide text-[var(--primary)] uppercase">{section.title}</h4>
            )}
            {/* Line-by-line rather than one flat paragraph — a branch line
                ("IF NOT INTERESTED: ...") and a jump instruction ("-> Jump to
                GRACEFUL EXIT") need to stand out from the plain script lines
                a rep reads aloud, so they can navigate the call live instead
                of re-reading the whole block to find the right branch. */}
            <div className="space-y-1">{renderBody(section.body)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
