import { describe, it, expect } from "vitest";
import { calculateFitScore, type IcpFieldDef } from "./fit-score";

const THRESHOLDS = { gradeAThreshold: 80, gradeBThreshold: 60, gradeCThreshold: 40 };

const SEGMENT_FIELD: IcpFieldDef = {
  key: "segment",
  label: "Segment",
  fieldType: "select",
  weight: 30,
  isRequired: false,
  options: [
    { value: "ideal", label: "Ideal", weight: 1, isIdeal: true },
    { value: "later", label: "Later priority", weight: 0.4 },
    { value: "other", label: "Other", weight: 0 },
  ],
};

const AUTHORITY_FIELD: IcpFieldDef = {
  key: "authority",
  label: "Decision authority",
  fieldType: "select",
  weight: 20,
  isRequired: false,
  options: [
    { value: "owner", label: "Owner", weight: 1, isIdeal: true },
    { value: "influencer", label: "Influencer", weight: 0.7 },
  ],
};

const BUDGET_FIELD: IcpFieldDef = {
  key: "has_budget",
  label: "Has budget",
  fieldType: "boolean",
  weight: 15,
  isRequired: false,
  options: null,
};

describe("calculateFitScore", () => {
  it("awards full weight for an ideal select option", () => {
    const result = calculateFitScore({ segment: "ideal" }, [SEGMENT_FIELD], THRESHOLDS);
    expect(result.score).toBe(30);
    expect(result.factors).toContain("Ideal: Segment");
  });

  it("awards partial weight for a later-priority option", () => {
    const result = calculateFitScore({ segment: "later" }, [SEGMENT_FIELD], THRESHOLDS);
    expect(result.score).toBe(12); // 30 * 0.4
  });

  it("awards zero for a zero-weight option and doesn't list it as a factor", () => {
    const result = calculateFitScore({ segment: "other" }, [SEGMENT_FIELD], THRESHOLDS);
    expect(result.score).toBe(0);
    expect(result.factors).toHaveLength(0);
  });

  it("awards full weight for a true boolean field", () => {
    const result = calculateFitScore({ has_budget: true }, [BUDGET_FIELD], THRESHOLDS);
    expect(result.score).toBe(15);
  });

  it("awards nothing for a false boolean field", () => {
    const result = calculateFitScore({ has_budget: false }, [BUDGET_FIELD], THRESHOLDS);
    expect(result.score).toBe(0);
  });

  it("combines multiple fields", () => {
    const result = calculateFitScore(
      { segment: "ideal", authority: "owner" },
      [SEGMENT_FIELD, AUTHORITY_FIELD],
      THRESHOLDS,
    );
    expect(result.score).toBe(50); // 30 + 20
  });

  it("caps score at 100", () => {
    const bigField: IcpFieldDef = { ...SEGMENT_FIELD, key: "big", weight: 90 };
    const result = calculateFitScore({ big: "ideal", segment: "ideal" }, [bigField, SEGMENT_FIELD], THRESHOLDS);
    expect(result.score).toBe(100);
  });

  it("grades A at or above the A threshold", () => {
    const aField: IcpFieldDef = { ...SEGMENT_FIELD, weight: 85 };
    const result = calculateFitScore({ segment: "ideal" }, [aField], THRESHOLDS);
    expect(result.score).toBe(85);
    expect(result.grade).toBe("A");
  });

  it("grades B in the B-to-A range", () => {
    const bField: IcpFieldDef = { ...SEGMENT_FIELD, weight: 65 };
    const result = calculateFitScore({ segment: "ideal" }, [bField], THRESHOLDS);
    expect(result.score).toBe(65);
    expect(result.grade).toBe("B");
  });

  it("returns Unscored (not Disqualified) when no ICP data has been entered", () => {
    const result = calculateFitScore({}, [SEGMENT_FIELD], THRESHOLDS);
    expect(result.score).toBe(0);
    expect(result.grade).toBe("Unscored");
  });

  it("returns Unscored (not Disqualified) when enrichment has run but no ICP answers exist", () => {
    // Enrichment (AI research) isn't an answer to any ICP field and earns no
    // score points — a lead with research done but never actually qualified
    // must still read as "haven't qualified this lead yet," not as a
    // rejection. (Previously hasEnrichment counted as qualification data,
    // which made every enriched-but-unqualified lead show Disqualified.)
    const result = calculateFitScore({}, [SEGMENT_FIELD], THRESHOLDS);
    expect(result.grade).toBe("Unscored");
  });

  it("returns Disqualified (not Unscored) when data was entered but scored low", () => {
    const result = calculateFitScore({ segment: "other" }, [SEGMENT_FIELD], THRESHOLDS);
    expect(result.score).toBe(0);
    expect(result.grade).toBe("Disqualified");
  });

  it("ignores an answer that doesn't match any option", () => {
    const result = calculateFitScore({ segment: "nonexistent" }, [SEGMENT_FIELD], THRESHOLDS);
    expect(result.score).toBe(0);
  });

  it("handles multiselect by taking the best matching option", () => {
    const multiField: IcpFieldDef = {
      key: "channels",
      label: "Channels",
      fieldType: "multiselect",
      weight: 20,
      isRequired: false,
      options: [
        { value: "email", label: "Email", weight: 0.5 },
        { value: "phone", label: "Phone", weight: 1 },
      ],
    };
    const result = calculateFitScore({ channels: ["email", "phone"] }, [multiField], THRESHOLDS);
    expect(result.score).toBe(20); // best option (phone, weight 1) wins
  });

  it("adds a disqualifier when a disqualifying select option is chosen", () => {
    const field: IcpFieldDef = {
      ...SEGMENT_FIELD,
      options: [...SEGMENT_FIELD.options!.map((o) => ({ ...o })), { value: "wrong", label: "Wrong fit", weight: 0, isDisqualifying: true }],
    };
    const result = calculateFitScore({ segment: "wrong" }, [field], THRESHOLDS);
    expect(result.disqualifiers).toContain("Segment: Wrong fit");
    expect(result.grade).toBe("Disqualified");
  });

  it("does not force Disqualified from a disqualifying option once score clears the B threshold elsewhere", () => {
    // Mirrors the source system's rule exactly: a disqualifier only forces
    // the grade when the raw score is still below the B threshold — a
    // red-flag answer on one field doesn't override an otherwise strong lead.
    const flaggedField: IcpFieldDef = {
      key: "flag",
      label: "Flag",
      fieldType: "select",
      weight: 5,
      isRequired: false,
      options: [{ value: "bad", label: "Bad sign", weight: 0, isDisqualifying: true }],
    };
    const strongField: IcpFieldDef = { ...SEGMENT_FIELD, weight: 90 };
    const result = calculateFitScore({ segment: "ideal", flag: "bad" }, [strongField, flaggedField], THRESHOLDS);
    expect(result.score).toBe(90);
    expect(result.disqualifiers).toContain("Flag: Bad sign");
    expect(result.grade).toBe("A");
  });

  it("adds a disqualifier for a disqualifying multiselect option even when another option in the same answer scores well", () => {
    const field: IcpFieldDef = {
      key: "channels",
      label: "Channels",
      fieldType: "multiselect",
      weight: 20,
      isRequired: false,
      options: [
        { value: "phone", label: "Phone", weight: 1 },
        { value: "cold", label: "Cold outreach", weight: 0, isDisqualifying: true },
      ],
    };
    const result = calculateFitScore({ channels: ["phone", "cold"] }, [field], THRESHOLDS);
    expect(result.score).toBe(20);
    expect(result.disqualifiers).toContain("Channels: Cold outreach");
  });

  it("awards full weight for a non-empty text/number field", () => {
    const textField: IcpFieldDef = {
      key: "notes",
      label: "Notes",
      fieldType: "text",
      weight: 5,
      isRequired: false,
      options: null,
    };
    const result = calculateFitScore({ notes: "something" }, [textField], THRESHOLDS);
    expect(result.score).toBe(5);
  });
});
