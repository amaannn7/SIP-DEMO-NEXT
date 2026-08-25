"use client";

import { useState } from "react";
import { Phone, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import type { callLogs, users, callScores } from "@/lib/db/schema";
import { CALL_OUTCOME_LABELS, NEXT_ACTION_LABELS } from "@/lib/calls/outcomes";
import { formatDateTime } from "@/lib/format-date";

type CallLogRow = typeof callLogs.$inferSelect & { loggedByUser: Pick<typeof users.$inferSelect, "displayName"> | null };
type CallScoreRow = typeof callScores.$inferSelect;

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export function CallLogHistory({ logs }: { logs: CallLogRow[] }) {
  if (logs.length === 0) return null;

  return (
    <div className="card-surface rounded-xl border border-border bg-card p-5">
      <h3 className="mb-3 text-[15px] font-semibold tracking-tight text-foreground">Call history</h3>
      <div className="space-y-3">
        {logs.map((log) => (
          <CallLogEntry key={log.id} log={log} />
        ))}
      </div>
    </div>
  );
}

function CallLogEntry({ log }: { log: CallLogRow }) {
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [loadingRecording, setLoadingRecording] = useState(false);
  const [score, setScore] = useState<CallScoreRow | "loading" | "unavailable" | null>(null);

  async function loadRecording() {
    if (recordingUrl || loadingRecording) return;
    setLoadingRecording(true);
    const res = await fetch(`/api/call-logs/${log.id}/recording`);
    if (res.ok) {
      const data = await res.json();
      setRecordingUrl(data.url);
    }
    setLoadingRecording(false);
  }

  async function toggleScore() {
    if (score) {
      setScore(null);
      return;
    }
    setScore("loading");
    const res = await fetch(`/api/call-logs/${log.id}/score`);
    if (res.ok) {
      const data = await res.json();
      setScore(data.score);
    } else {
      setScore("unavailable");
    }
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">
            {log.outcome ? CALL_OUTCOME_LABELS[log.outcome] : "Not yet logged"}
          </span>
          {log.via === "aircall" && (
            <span className="flex items-center gap-1 rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
              <Phone className="size-2.5" />
              Aircall
            </span>
          )}
          {log.durationSeconds != null && (
            <span className="text-[11px] text-muted-foreground">{formatDuration(log.durationSeconds)}</span>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">{formatDateTime(new Date(log.createdAt))}</span>
      </div>

      {log.nextAction && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Next:</span> {NEXT_ACTION_LABELS[log.nextAction]}
        </p>
      )}
      {log.notes && <p className="mt-1 text-xs text-muted-foreground">{log.notes}</p>}
      {log.loggedByUser && <p className="mt-1 text-[11px] text-muted-foreground">Logged by {log.loggedByUser.displayName}</p>}

      {log.recordingKey && (
        <div className="mt-2">
          {recordingUrl ? (
            <audio controls src={recordingUrl} className="h-8 w-full" />
          ) : (
            <button
              type="button"
              onClick={loadRecording}
              disabled={loadingRecording}
              className="flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-60"
            >
              {loadingRecording ? <Loader2 className="size-3 animate-spin" /> : <Phone className="size-3" />}
              Play recording
            </button>
          )}
        </div>
      )}

      {log.via === "aircall" && (
        <div className="mt-2">
          <button
            type="button"
            onClick={toggleScore}
            className="flex h-7 items-center gap-1 rounded-md border border-border px-2.5 text-[11px] text-muted-foreground hover:bg-muted"
          >
            {score ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            AI call score
          </button>
          {score === "loading" && <p className="mt-1.5 text-[11px] text-muted-foreground">Loading…</p>}
          {score === "unavailable" && <p className="mt-1.5 text-[11px] text-muted-foreground">Not scored yet.</p>}
          {score && typeof score === "object" && <ScoreBreakdown score={score} />}
        </div>
      )}
    </div>
  );
}

function ScoreBreakdown({ score }: { score: CallScoreRow }) {
  if (!score.eligible) {
    return <p className="mt-1.5 text-[11px] text-muted-foreground">Not eligible for scoring: {score.ineligibleReason}</p>;
  }
  return (
    <div className="mt-1.5 space-y-1.5 rounded-md bg-muted/40 p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{score.finalScore?.toFixed(0)} / 100</span>
        <span className="text-[11px] text-muted-foreground capitalize">{score.classification?.replace(/_/g, " ")}</span>
      </div>
      {score.strengths.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Strengths:</span> {score.strengths.join("; ")}
        </p>
      )}
      {score.coachingOpportunities.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Coaching:</span> {score.coachingOpportunities.join("; ")}
        </p>
      )}
    </div>
  );
}
