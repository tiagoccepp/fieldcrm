// Typed fetch wrapper: cookies-first auth, JSON errors, offline detection.

export interface ApiErrorShape {
  error: string;
  hint?: string;
}

export class ApiError extends Error {
  status: number;
  hint?: string;
  constructor(status: number, shape: ApiErrorShape) {
    super(shape.error);
    this.status = status;
    this.hint = shape.hint;
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const headers: Record<string, string> = {};
  let body: string | undefined;
  if (init?.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers,
      body,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, { error: "Network unreachable", hint: "Queued offline — sync when back" });
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as ApiErrorShape | T;
  if (!res.ok) {
    const shape = (data as ApiErrorShape) || { error: `HTTP ${res.status}` };
    throw new ApiError(res.status, shape);
  }
  return data as T;
}

export interface Me {
  id: string;
  orgId: string;
  orgName: string;
  email: string;
  name: string;
  role: "owner" | "dispatcher" | "tech";
}

export type JobStatus = "scheduled" | "en_route" | "on_site" | "done" | "canceled";

export interface JobRow {
  id: string;
  customerId: string;
  customerName: string;
  title: string;
  description: string | null;
  status: JobStatus;
  priceCents: number;
  scheduledFor: string | null;
  completedAt: string | null;
  assignedTo: string | null;
  paid: boolean;
  updatedAt: string;
}

export interface JobStep {
  id: string;
  label: string;
  done: boolean;
  position: number;
}

export interface Activity {
  id: string;
  kind: string;
  body: string;
  createdAt: string;
}

export interface JobDetail extends JobRow {
  steps: JobStep[];
  activities: Activity[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}

export interface Followup {
  id: string;
  jobId: string | null;
  jobTitle: string | null;
  customerId: string;
  customerName: string;
  title: string;
  dueAt: string | null;
  done: boolean;
  draft: string | null;
  createdAt: string;
}

export interface AnalyticsSummary {
  pipeline: Record<JobStatus, number>;
  jobsThisWeek: number;
  doneThisWeek: number;
  revenueCents: { total: number; byTech: { name: string; cents: number }[] };
  onTimePct: number | null;
  overdueFollowups: number;
}

export function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

const STATUS_LABEL: Record<JobStatus, string> = {
  scheduled: "Scheduled",
  en_route: "En route",
  on_site: "On site",
  done: "Done",
  canceled: "Canceled",
};

export function statusLabel(s: JobStatus): string {
  return STATUS_LABEL[s];
}

const NEXT: Partial<Record<JobStatus, { to: JobStatus; verb: string }>> = {
  scheduled: { to: "en_route", verb: "Mark en route" },
  en_route: { to: "on_site", verb: "Mark on site" },
  on_site: { to: "done", verb: "Mark done" },
};

export function nextStep(s: JobStatus) {
  return NEXT[s] ?? null;
}
