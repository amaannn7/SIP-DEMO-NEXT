"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { leads, enrichmentResults, emailHistory, callPitches, callLogs, users } from "@/lib/db/schema";
import { WorkflowStepper } from "./workflow-stepper";
import { StageSelect } from "./stage-select";
import { CloseOutButtons } from "./close-out-buttons";
import { SourceBadge } from "./source-badge";
import { GradeBadge } from "./grade-badge";
import { GradeOverrideControl } from "./grade-override-control";
import { LeadProfileTab } from "./lead-profile-tab";
import { ResearchAction } from "./research-action";
import { EnrichmentPanel } from "./enrichment-panel";
import { CallAnchorCard } from "./call-anchor-card";
import { GenerateEmailAction } from "./generate-email-action";
import { EmailHistoryPanel } from "./email-history-panel";
import { SkipEmailButton } from "./skip-email-button";
import { GenerateCallPitchAction } from "./generate-call-pitch-action";
import { CallPitchesPanel } from "./call-pitches-panel";
import { LogCallPanel } from "./log-call-panel";
import { CallLogHistory } from "./call-log-history";
import { AircallBlock } from "./aircall-block";
import { ContinueToNextStep } from "./continue-to-next-step";
import { getWorkflowStepStatus, isStepUnlocked, describeNextActionDetailed, type WorkflowStep } from "@/lib/leads/workflow";
import type { IcpFieldDef } from "@/lib/scoring/fit-score";

type Lead = typeof leads.$inferSelect;
type EnrichmentRow = typeof enrichmentResults.$inferSelect;
type EmailRow = typeof emailHistory.$inferSelect;
type CallPitchRow = typeof callPitches.$inferSelect;
type CallLogRow = typeof callLogs.$inferSelect & { loggedByUser: Pick<typeof users.$inferSelect, "displayName"> | null };

const LOCKED_TOAST_MESSAGE: Partial<Record<WorkflowStep, string>> = {
  email: "Complete research first",
  call: "Send an email first",
};

export function LeadWorkflowTabs({
  lead,
  enrichment,
  emails,
  pitches,
  callLogRows,
  icpFields,
  aircallEnabled,
}: {
  lead: Lead;
  enrichment: EnrichmentRow | undefined;
  emails: EmailRow[];
  pitches: CallPitchRow[];
  callLogRows: CallLogRow[];
  icpFields: IcpFieldDef[];
  aircallEnabled: boolean;
}) {
  const status = getWorkflowStepStatus(lead);
  // Always opens on Profile, matching the source system's lead detail modal
  // — it never auto-jumps to the "current" workflow step on open.
  const [activeStep, setActiveStep] = useState<WorkflowStep>("profile");
  const nextAction = describeNextActionDetailed(lead);

  const lockedSteps = new Set<WorkflowStep>(
    (["research", "email", "call", "outcome"] as WorkflowStep[]).filter((step) => !isStepUnlocked(step, lead)),
  );

  function handleSelect(step: WorkflowStep) {
    // A locked tab never switches — it just explains why, matching the
    // source system's activateLeadTab (a locked tab's click re-fires its
    // own toast instead of ever actually changing the active tab).
    if (lockedSteps.has(step)) {
      toast.warning(LOCKED_TOAST_MESSAGE[step] ?? "This step isn't available yet");
      return;
    }
    setActiveStep(step);
  }

  return (
    <div className="space-y-5">
      <WorkflowStepper
        status={status}
        activeStep={activeStep}
        onSelect={handleSelect}
        lockedSteps={lockedSteps}
        nextActionLabel={nextAction.label}
        nextActionDetail={nextAction.detail}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <StageSelect leadId={lead.id} stage={lead.stage} />
          <SourceBadge source={lead.source} />
          <GradeBadge grade={lead.fitGrade} score={lead.fitScore} />
          <GradeOverrideControl leadId={lead.id} override={lead.gradeOverride} />
        </div>
        <CloseOutButtons leadId={lead.id} stage={lead.stage} />
      </div>

      {activeStep === "profile" && (
        <div className="space-y-4">
          <ContinueToNextStep
            currentStep="profile"
            isNextLocked={lockedSteps.has("research")}
            onContinue={handleSelect}
            compact
          />
          <LeadProfileTab lead={lead} onNavigateToStep={handleSelect} />
        </div>
      )}

      {activeStep === "research" && (
        <div className="space-y-4">
          <ContinueToNextStep
            currentStep="research"
            isNextLocked={lockedSteps.has("email")}
            nextLockedReason={LOCKED_TOAST_MESSAGE.email}
            onContinue={handleSelect}
            compact
          />
          <CallAnchorCard leadId={lead.id} value={lead.callAnchor} />
          <ResearchAction leadId={lead.id} hasEnrichment={lead.hasEnrichment} />
          {enrichment && <EnrichmentPanel enrichment={enrichment} />}
        </div>
      )}

      {activeStep === "email" && (
        <div className="space-y-4">
          <ContinueToNextStep
            currentStep="email"
            isNextLocked={lockedSteps.has("call")}
            nextLockedReason={LOCKED_TOAST_MESSAGE.call}
            onContinue={handleSelect}
            compact
          />
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <GenerateEmailAction leadId={lead.id} />
            </div>
            {/* Once an email has actually been sent (or the step already
                skipped), re-skipping is meaningless — Call is already unlocked. */}
            {lead.emailsSentCount === 0 && lead.emailSkipped === null && <SkipEmailButton leadId={lead.id} />}
          </div>
          <EmailHistoryPanel leadId={lead.id} leadEmail={lead.email} emails={emails} />
        </div>
      )}

      {activeStep === "call" && (
        <div className="space-y-4">
          <ContinueToNextStep
            currentStep="call"
            isNextLocked={lockedSteps.has("outcome")}
            onContinue={handleSelect}
            compact
          />
          {/* Ports the source system's callPitchContent ordering exactly:
              the Aircall dial block and call history sit above pitch
              generation, not below it — a rep opening the Call tab sees "can
              I just call them right now" before "let me write a script." */}
          {aircallEnabled && <AircallBlock leadId={lead.id} phone={lead.phone} onStarted={() => setActiveStep("outcome")} />}
          {aircallEnabled && callLogRows.length > 0 && <CallLogHistory logs={callLogRows} />}
          <GenerateCallPitchAction leadId={lead.id} />
          {/* onCallStarted jumps straight to Outcome once the rep starts the
              call — matches the source system's start-call flow, which
              advances the stage and switches tabs in the same action rather
              than leaving the rep to notice Outcome unlocked and click over. */}
          <CallPitchesPanel
            leadId={lead.id}
            pitches={pitches}
            onCallStarted={() => setActiveStep("outcome")}
          />
        </div>
      )}

      {activeStep === "outcome" && (
        <div className="space-y-4">
          <LogCallPanel leadId={lead.id} icpFields={icpFields} answers={lead.customFields} />
          <CallLogHistory logs={callLogRows} />
        </div>
      )}
    </div>
  );
}
