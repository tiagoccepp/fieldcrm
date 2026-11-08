// Shared domain contracts: status machine, roles, API shapes. No deps.

export const JOB_STATUSES = [
  "scheduled",
  "en_route",
  "on_site",
  "done",
  "canceled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

const FLOW: Record<JobStatus, JobStatus[]> = {
  scheduled: ["en_route", "canceled"],
  en_route: ["on_site", "canceled"],
  on_site: ["done", "canceled"],
  done: [],
  canceled: [],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return FLOW[from].includes(to);
}

export const ROLES = ["owner", "dispatcher", "tech"] as const;
export type Role = (typeof ROLES)[number];

export function canManageJobs(role: Role): boolean {
  return role === "owner" || role === "dispatcher";
}

export interface ApiError {
  error: string;
  hint?: string;
}

export interface Me {
  id: string;
  orgId: string;
  orgName: string;
  email: string;
  name: string;
  role: Role;
}

export interface AnalyticsSummary {
  pipeline: Record<JobStatus, number>;
  jobsThisWeek: number;
  doneThisWeek: number;
  revenueCents: { total: number; byTech: { name: string; cents: number }[] };
  onTimePct: number | null;
  overdueFollowups: number;
}
