"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";

type JobStatusResponse = {
  success: boolean;
  status?: "pending" | "processing" | "completed" | "failed";
  error?: string;
};

// If a job hasn't settled by this point, the worker is very likely down —
// stop polling and surface an error instead of spinning the button forever
// with no feedback. A normal AI generation completes in well under a minute.
const POLL_TIMEOUT_MS = 90_000;

function useJobPolling(jobRunId: string | null, onSettled: () => void) {
  const startedAtRef = useRef<number | null>(null);
  if (jobRunId && startedAtRef.current === null) startedAtRef.current = Date.now();
  if (!jobRunId) startedAtRef.current = null;

  return useQuery({
    queryKey: ["job-run", jobRunId],
    queryFn: async (): Promise<JobStatusResponse> => {
      const res = await fetch(`/api/jobs/${jobRunId}`);
      const data = (await res.json()) as JobStatusResponse;
      if (data.status === "completed" || data.status === "failed") {
        onSettled();
        return data;
      }
      if (startedAtRef.current !== null && Date.now() - startedAtRef.current > POLL_TIMEOUT_MS) {
        return { success: false, status: "failed", error: "Generation is taking longer than expected. Try again in a moment." };
      }
      return data;
    },
    enabled: jobRunId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "completed" || status === "failed" ? false : 2000;
    },
    // Keeps returning the last-known status immediately once jobRunId changes,
    // instead of dropping to `undefined` for one render while the first poll
    // is in flight — that gap was making `isBusy` read false right after a
    // fresh click, so the button flickered back to idle before genuinely
    // settling. Not the actual generation failing, just the busy indicator
    // lying about it.
    placeholderData: (previousData) => previousData,
  });
}

/** Shared enqueue -> poll -> refresh flow for the three "Ask AI" job triggers (research/email/call pitch), one instance per tab. */
export function useAiJobTrigger(trigger: () => Promise<{ jobRunId: string } | { error: string }>) {
  const router = useRouter();
  const [activeJobRunId, setActiveJobRunId] = useState<string | null>(null);
  const [enqueueError, setEnqueueError] = useState<string | null>(null);

  const refreshLeadData = () => router.refresh();
  const jobStatus = useJobPolling(activeJobRunId, refreshLeadData);

  const mutation = useMutation({
    mutationFn: trigger,
    onMutate: () => setEnqueueError(null),
    onSuccess: (result) => {
      if ("jobRunId" in result) {
        setActiveJobRunId(result.jobRunId);
      } else {
        setEnqueueError(result.error);
      }
    },
  });

  // Busy from the moment the button is clicked (mutation in flight) straight
  // through to the job actually settling — previously there was a gap right
  // after the enqueue call resolved, before the first status poll landed,
  // where isBusy briefly read false and the spinner disappeared mid-generation.
  const isBusy = mutation.isPending || activeJobRunId !== null && jobStatus.data?.status !== "completed" && jobStatus.data?.status !== "failed";
  const error = enqueueError ?? (jobStatus.data?.status === "failed" ? (jobStatus.data.error ?? "Generation failed") : null);

  return { trigger: () => mutation.mutate(), isBusy, error };
}
