import { IUser } from "../models/User";
import { IJob } from "../models/Job";

/**
 * Eligibility engine — the AUTHORITATIVE check.
 *
 * The frontend runs the same logic for instant UX, but the server must
 * re-check before creating an application. Never trust the client: a
 * student could craft a request to apply to a job they're not eligible
 * for, so this gate runs in the apply flow.
 *
 * Pure function: (student, job) → result. Easy to test, no side effects.
 */
export interface EligibilityCheck {
  name: string;
  pass: boolean;
  actual: number | string;
  required: number | string;
}

export interface EligibilityResult {
  eligible: boolean;
  passed: number;
  total: number;
  checks: EligibilityCheck[];
  reasons: string[];
}

export function checkEligibility(student: IUser, job: IJob): EligibilityResult {
  const e = job.eligibility;
  const checks: EligibilityCheck[] = [
    {
      name: "CGPA",
      pass: (student.cgpa ?? 0) >= e.minCgpa,
      actual: student.cgpa ?? 0,
      required: e.minCgpa,
    },
    {
      name: "10th %",
      pass: (student.tenthPercent ?? 0) >= e.minTenth,
      actual: student.tenthPercent ?? 0,
      required: e.minTenth,
    },
    {
      name: "12th %",
      pass: (student.twelfthPercent ?? 0) >= e.minTwelfth,
      actual: student.twelfthPercent ?? 0,
      required: e.minTwelfth,
    },
    {
      name: "Branch",
      pass: e.branches.length === 0 || e.branches.includes(student.branch as any),
      actual: student.branch ?? "—",
      required: e.branches.join(", ") || "Any",
    },
    {
      name: "Backlogs",
      pass: (student.backlogs ?? 0) <= e.maxBacklogs,
      actual: student.backlogs ?? 0,
      required: `≤ ${e.maxBacklogs}`,
    },
  ];

  const passed = checks.filter((c) => c.pass).length;
  const reasons = checks.filter((c) => !c.pass).map((c) => c.name);

  return {
    eligible: passed === checks.length,
    passed,
    total: checks.length,
    checks,
    reasons,
  };
}
