"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { leads, leadStageEnum } from "@/lib/db/schema";
import { updateLeadStageAction } from "../[id]/stage-actions";

type Lead = typeof leads.$inferSelect;
type LeadStage = (typeof leadStageEnum.enumValues)[number];

type LeadsResponse = {
  leads: Lead[];
  pagination: { page: number; perPage: number; total: number; pages: number };
  stageCounts: Partial<Record<LeadStage, number>>;
};

/**
 * Wraps updateLeadStageAction (a Server Action that mutates via
 * revalidatePath, not a return value) in a TanStack Query mutation so a
 * card drag can update every "leads-list"-keyed query in the client cache
 * immediately, instead of waiting on a round trip — revalidatePath alone
 * only invalidates Server Component renders, it never reaches a
 * client-held query cache. Rolls back to the pre-drag snapshot on failure
 * (denied write access, network error) and re-syncs with the server after.
 */
export function useUpdateLeadStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, stage }: { leadId: string; stage: LeadStage }) => {
      await updateLeadStageAction(leadId, stage);
    },
    onMutate: async ({ leadId, stage }) => {
      await queryClient.cancelQueries({ queryKey: ["leads-list"] });

      const previous = queryClient.getQueriesData<LeadsResponse>({ queryKey: ["leads-list"] });

      queryClient.setQueriesData<LeadsResponse>({ queryKey: ["leads-list"] }, (old) => {
        if (!old) return old;
        const existing = old.leads.find((l) => l.id === leadId);
        if (!existing || existing.stage === stage) return old;

        const stageCounts = { ...old.stageCounts };
        stageCounts[existing.stage] = Math.max(0, (stageCounts[existing.stage] ?? 0) - 1);
        stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;

        return {
          ...old,
          leads: old.leads.map((l) => (l.id === leadId ? { ...l, stage, lastActivityAt: new Date() } : l)),
          stageCounts,
        };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error("Couldn't move the lead. Reverted.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-list"] });
    },
  });
}
