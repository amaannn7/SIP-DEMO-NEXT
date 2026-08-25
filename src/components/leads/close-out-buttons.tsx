"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, XCircle, Ban } from "lucide-react";
import type { leadStageEnum } from "@/lib/db/schema";
import {
  markLeadWonAction,
  markLeadLostAction,
  dropLeadAction,
  type MarkLeadLostState,
  type DropLeadState,
} from "@/app/(dashboard)/leads/[id]/close-out-actions";

type LeadStage = (typeof leadStageEnum.enumValues)[number];

const CLOSE_OUT_VISIBLE_STAGES = new Set<LeadStage>(["consultation_booked", "won", "lost"]);
const CLOSED_STAGES = new Set<LeadStage>(["nurture_parked", "won", "lost"]);

const initialLostState: MarkLeadLostState = {};
const initialDropState: DropLeadState = {};

export function CloseOutButtons({ leadId, stage }: { leadId: string; stage: LeadStage }) {
  const [isPendingWon, startWonTransition] = useTransition();
  const [showWonPrompt, setShowWonPrompt] = useState(false);
  const [showLostPrompt, setShowLostPrompt] = useState(false);
  const [showDropPrompt, setShowDropPrompt] = useState(false);
  const [lostState, lostFormAction] = useActionState(markLeadLostAction.bind(null, leadId), initialLostState);
  const [dropState, dropFormAction] = useActionState(dropLeadAction.bind(null, leadId), initialDropState);

  const isWon = stage === "won";
  const isLost = stage === "lost";
  // Drop (-> nurture_parked) is reachable from any open stage, not just the
  // consultation_booked/won/lost trio Won/Lost are gated on — matches the
  // source system's drop-lead, callable from anywhere in the pipeline.
  const canDrop = !CLOSED_STAGES.has(stage);
  const showWonLost = CLOSE_OUT_VISIBLE_STAGES.has(stage);

  if (!showWonLost && !canDrop) return null;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {canDrop && (
          <button
            type="button"
            onClick={() => setShowDropPrompt((v) => !v)}
            className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <Ban className="size-3.5" />
            Park / Reject
          </button>
        )}
        {showWonLost && (
          <>
            <button
              type="button"
              disabled={isWon || isPendingWon}
              onClick={() => setShowWonPrompt((v) => !v)}
              className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold shadow-sm transition-all disabled:cursor-default ${
                isWon
                  ? "border border-success/40 bg-success/10 text-success"
                  : "bg-[var(--success)] text-white hover:opacity-90"
              }`}
            >
              <CheckCircle2 className="size-4" />
              {isWon ? "Won" : "Mark as Won"}
            </button>
            <button
              type="button"
              disabled={isLost}
              onClick={() => setShowLostPrompt((v) => !v)}
              className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold shadow-sm transition-all disabled:cursor-default ${
                isLost
                  ? "border border-destructive/40 bg-destructive/10 text-destructive"
                  : "bg-[var(--destructive)] text-white hover:opacity-90"
              }`}
            >
              <XCircle className="size-4" />
              {isLost ? "Lost" : "Mark as Lost"}
            </button>
          </>
        )}
      </div>

      {/* Ports the source system's markLeadWon() customConfirm() step — Won
          has no reason field to double as an implicit confirmation gate
          (unlike Lost/Drop), so it needs its own explicit yes/no prompt. */}
      {showWonPrompt && !isWon && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Mark this lead as Won?</span>
          <button
            type="button"
            disabled={isPendingWon}
            onClick={() => {
              startWonTransition(() => markLeadWonAction(leadId));
              setShowWonPrompt(false);
            }}
            className="h-8 rounded-md px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "var(--success)" }}
          >
            {isPendingWon ? "Saving…" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setShowWonPrompt(false)}
            className="h-8 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      )}

      {showDropPrompt && (
        <form
          action={(formData) => {
            dropFormAction(formData);
            setShowDropPrompt(false);
          }}
          className="flex items-center gap-2"
        >
          <input
            name="reason"
            type="text"
            placeholder="Why park/reject this lead? (optional)"
            maxLength={500}
            className="h-8 w-64 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-[var(--primary)]"
          />
          <SubmitButton label="Confirm" />
        </form>
      )}
      {dropState.error && <p className="text-xs text-destructive">{dropState.error}</p>}

      {showLostPrompt && !isLost && (
        <form
          action={(formData) => {
            lostFormAction(formData);
            setShowLostPrompt(false);
          }}
          className="flex items-center gap-2"
        >
          <input
            name="reason"
            type="text"
            placeholder="Why was this lead lost? (optional)"
            maxLength={500}
            className="h-8 w-64 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-[var(--primary)]"
          />
          <SubmitButton label="Confirm" destructive />
        </form>
      )}
      {lostState.error && <p className="text-xs text-destructive">{lostState.error}</p>}
    </div>
  );
}

function SubmitButton({ label, destructive }: { label: string; destructive?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-8 rounded-md px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{ background: destructive ? "var(--destructive)" : "var(--primary)" }}
    >
      {pending ? "Saving…" : label}
    </button>
  );
}
