"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveSenderProfileAction, type SaveSenderProfileState } from "./actions";
import type { EffectiveSenderProfile } from "@/lib/db/queries/sender-profile";

const initialState: SaveSenderProfileState = {};

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10";
const textareaClass =
  "w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10";
const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";

export function MyContextForm({ profile }: { profile: EffectiveSenderProfile }) {
  const [state, formAction] = useActionState(saveSenderProfileAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card-surface rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-[15px] font-semibold tracking-tight text-foreground">Your info</h3>
          <div className="space-y-3">
            <div>
              <label className={labelClass} htmlFor="senderName">Your name</label>
              <input id="senderName" name="senderName" defaultValue={profile.senderName} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="senderTitle">Title</label>
                <input id="senderTitle" name="senderTitle" defaultValue={profile.senderTitle} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="senderCompany">Company</label>
                <input id="senderCompany" name="senderCompany" defaultValue={profile.senderCompany} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="calendarLink">Calendar link</label>
              <input
                id="calendarLink"
                name="calendarLink"
                type="url"
                placeholder="https://cal.com/you"
                defaultValue={profile.calendarLink}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="card-surface rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-[15px] font-semibold tracking-tight text-foreground">Email settings</h3>
          <div className="space-y-3">
            <div>
              <label className={labelClass} htmlFor="emailTone">Tone</label>
              <select id="emailTone" name="emailTone" defaultValue={profile.emailTone} className={inputClass}>
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="friendly">Friendly</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="companyDescription">Company description</label>
              <textarea
                id="companyDescription"
                name="companyDescription"
                rows={2}
                placeholder="Uses your organization's default if left blank"
                defaultValue={profile.companyDescription}
                className={textareaClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="valueProposition">Value proposition</label>
              <textarea
                id="valueProposition"
                name="valueProposition"
                rows={2}
                placeholder="Uses your organization's default if left blank"
                defaultValue={profile.valueProposition}
                className={textareaClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="socialProof">Social proof</label>
              <textarea
                id="socialProof"
                name="socialProof"
                rows={2}
                placeholder="Uses your organization's default if left blank"
                defaultValue={profile.socialProof}
                className={textareaClass}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card-surface rounded-xl border border-border bg-card p-5">
        <h3 className="mb-1 text-[15px] font-semibold tracking-tight text-foreground">Email signature</h3>
        <p className="mb-3 text-[11px] text-muted-foreground">Appended to AI-generated emails.</p>
        <textarea id="signature" name="signature" rows={4} defaultValue={profile.signature} className={textareaClass} />
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton />
        {state.error && <p className="text-xs text-destructive">{state.error}</p>}
        {state.success && <p className="text-xs text-success">Saved.</p>}
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 rounded-md px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{ background: "var(--primary)" }}
    >
      {pending ? "Saving…" : "Save settings"}
    </button>
  );
}
