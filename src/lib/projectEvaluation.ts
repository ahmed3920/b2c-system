/** Phase 1 functionality audit model (see the Student Project Evaluation System). */

export type EvalStatus =
  | "fully_working"
  | "partially_working"
  | "not_working"
  | "invalid_submission"
  | "pending";

export const EVAL_STATUS_OPTIONS: {
  value: EvalStatus;
  label: string;
  points: number;
  help: string;
}[] = [
  {
    value: "fully_working",
    label: "Fully Working (5)",
    points: 5,
    help: "The link is valid, the project launches, and the core function works.",
  },
  {
    value: "partially_working",
    label: "Partially Working (3)",
    points: 3,
    help: "The project opens, but the core function is incomplete or fails in part.",
  },
  {
    value: "not_working",
    label: "Not Working (0)",
    points: 0,
    help: "The project cannot run, or the core function fails completely.",
  },
  {
    value: "invalid_submission",
    label: "Invalid Submission (0)",
    points: 0,
    help: "The link is fake, broken, inaccessible, or unrelated to the listed project.",
  },
  {
    value: "pending",
    label: "External Technical Blocker (Pending)",
    points: 0,
    help: "A documented platform or network issue prevents a fair test. Recheck required.",
  },
];

export const MAX_POINTS = 5;

export function statusPoints(status: EvalStatus) {
  return EVAL_STATUS_OPTIONS.find((o) => o.value === status)?.points ?? 0;
}

export function statusLabel(status: EvalStatus | null | undefined) {
  if (!status) return "Not evaluated";
  return EVAL_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function statusShortLabel(status: EvalStatus | null | undefined) {
  switch (status) {
    case "fully_working":
      return "Fully working";
    case "partially_working":
      return "Partially working";
    case "not_working":
      return "Not working";
    case "invalid_submission":
      return "Invalid";
    case "pending":
      return "Pending recheck";
    default:
      return "Not evaluated";
  }
}

/** Evidence (note + screenshot link) is required unless the project fully works. */
export function needsEvidence(status: EvalStatus) {
  return status !== "fully_working";
}

/** Phase 1 outcome = coverage 40% + functionality 60%. */
export function phase1Outcome(coveragePct: number, functionalityPct: number) {
  return coveragePct * 0.4 + functionalityPct * 0.6;
}

export const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v.toFixed(digits)}%`;
