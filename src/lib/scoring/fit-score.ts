import type { IcpFieldOption } from "@/lib/db/schema";

export type IcpFieldDef = {
  key: string;
  label: string;
  subtitle?: string | null;
  fieldType: "text" | "number" | "boolean" | "select" | "multiselect";
  options: IcpFieldOption[] | null;
  weight: number;
  isRequired: boolean;
};

export type FitScoreResult = {
  score: number;
  grade: "A" | "B" | "C" | "Disqualified" | "Unscored";
  factors: string[];
  disqualifiers: string[];
};

export type FitGradeThresholds = {
  gradeAThreshold: number;
  gradeBThreshold: number;
  gradeCThreshold: number;
};

/**
 * Generic ICP fit scoring — ports the source system's calculateLeadGrade
 * mechanism (weighted field answers -> 0-100 score -> letter grade) without
 * any hardcoded field names or industry-specific values. Each org defines
 * its own icpFields; this function only ever reads them by key/weight.
 *
 * For a select/multiselect field, the lead's answer earns
 * `field.weight * option.weight` points (option.weight is a 0-1 fraction of
 * the field's total weight — mirrors the source system's full-credit vs.
 * partial-credit segments, generalized to any field). A boolean field earns
 * full weight when true. A field with no matching option/no answer earns 0
 * and contributes no factor.
 */
export function calculateFitScore(
  customFields: Record<string, unknown>,
  icpFieldDefs: IcpFieldDef[],
  thresholds: FitGradeThresholds,
): FitScoreResult {
  let score = 0;
  const factors: string[] = [];
  const disqualifiers: string[] = [];

  for (const field of icpFieldDefs) {
    const answer = customFields[field.key];

    if (field.fieldType === "boolean") {
      if (answer === true) {
        score += field.weight;
        factors.push(field.label);
      }
      continue;
    }

    if (field.fieldType === "select" && typeof answer === "string" && field.options) {
      const option = field.options.find((o) => o.value === answer);
      if (option) {
        const earned = Math.round(field.weight * option.weight);
        score += earned;
        if (earned > 0) {
          factors.push(option.isIdeal ? `Ideal: ${field.label}` : field.label);
        }
        if (option.isDisqualifying) {
          disqualifiers.push(`${field.label}: ${option.label}`);
        }
      }
      continue;
    }

    if (field.fieldType === "multiselect" && Array.isArray(answer) && field.options) {
      const selected = field.options.filter((o) => answer.includes(o.value));
      if (selected.length > 0) {
        const bestOption = selected.reduce((best, o) => (o.weight > best.weight ? o : best), selected[0]);
        const earned = Math.round(field.weight * bestOption.weight);
        score += earned;
        if (earned > 0) {
          factors.push(field.label);
        }
        for (const option of selected) {
          if (option.isDisqualifying) {
            disqualifiers.push(`${field.label}: ${option.label}`);
          }
        }
      }
      continue;
    }

    // text/number fields: presence alone earns full weight — there's no
    // ranked-option concept to award partial credit against.
    if ((field.fieldType === "text" || field.fieldType === "number") && answer !== undefined && answer !== null && answer !== "") {
      score += field.weight;
      factors.push(field.label);
    }
  }

  // Enrichment (AI research) contributes nothing to the score and isn't an
  // answer to any ICP field — a lead can have research done and still never
  // have been through qualification. Treating hasEnrichment as "we have
  // qualification data" made a lead with research-but-no-ICP-answers read
  // as Disqualified (a real rejection) when nobody has actually qualified
  // it yet; it should stay Unscored until someone fills in the ICP form.
  const hasQualificationData = Object.keys(customFields).length > 0;
  const grade = deriveGrade(score, disqualifiers, hasQualificationData, thresholds);

  return {
    score: Math.max(0, Math.min(100, score)),
    grade,
    factors,
    disqualifiers,
  };
}

function deriveGrade(
  score: number,
  disqualifiers: string[],
  hasQualificationData: boolean,
  thresholds: FitGradeThresholds,
): FitScoreResult["grade"] {
  if (disqualifiers.length > 0 && score < thresholds.gradeBThreshold) {
    return "Disqualified";
  }
  if (score >= thresholds.gradeAThreshold) return "A";
  if (score >= thresholds.gradeBThreshold) return "B";
  if (score >= thresholds.gradeCThreshold) return "C";
  // Distinguishes "actively disqualified" from "not enough data yet" — the
  // latter must never read as a rejection, or a lead with no ICP answers
  // silently disappears from views that filter out Disqualified leads.
  if (!hasQualificationData) return "Unscored";
  return "Disqualified";
}
