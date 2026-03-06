/**
 * Client-safe contracts for the recurring bills feature.
 * No server-only imports allowed here.
 */

export type RecurringBillCategory =
  | "subscription"
  | "utility"
  | "rent"
  | "insurance"
  | "loan"
  | "payroll"
  | "marketing"
  | "software"
  | "other";

export type RecurrenceInterval =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "annually";

export type RecurringBillOccurrenceStatus = "pending" | "confirmed" | "skipped";

// ─── Display helpers ─────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<RecurringBillCategory, string> = {
  subscription: "Subscription",
  utility: "Utility",
  rent: "Rent / Lease",
  insurance: "Insurance",
  loan: "Loan / Credit",
  payroll: "Payroll",
  marketing: "Marketing",
  software: "Software",
  other: "Other",
};

export const RECURRENCE_LABELS: Record<RecurrenceInterval, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

export const CATEGORY_OPTIONS: { value: RecurringBillCategory; label: string }[] =
  (Object.keys(CATEGORY_LABELS) as RecurringBillCategory[]).map((k) => ({
    value: k,
    label: CATEGORY_LABELS[k],
  }));

export const RECURRENCE_OPTIONS: { value: RecurrenceInterval; label: string }[] =
  (Object.keys(RECURRENCE_LABELS) as RecurrenceInterval[]).map((k) => ({
    value: k,
    label: RECURRENCE_LABELS[k],
  }));

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface RecurringBillSummary {
  id: string;
  name: string;
  amount: number;
  category: RecurringBillCategory;
  recurrence: RecurrenceInterval;
  recurrenceDay: number | null;
  nextDueAt: string;        // ISO string
  startedAt: string;        // ISO string
  isActive: boolean;
  notes: string | null;
  createdAt: string;
}

export interface PendingBillOccurrence {
  id: string;
  billId: string;
  billName: string;
  amount: number;
  category: RecurringBillCategory;
  recurrence: RecurrenceInterval;
  dueAt: string;            // ISO string
  status: RecurringBillOccurrenceStatus;
}

export interface CreateRecurringBillInput {
  name: string;
  amount: number;
  category: RecurringBillCategory;
  recurrence: RecurrenceInterval;
  recurrenceDay?: number;
  startedAt: string;        // ISO string — when the bill first started/starts
  notes?: string;
}

export interface UpdateRecurringBillInput {
  id: string;
  name?: string;
  amount?: number;
  category?: RecurringBillCategory;
  recurrence?: RecurrenceInterval;
  recurrenceDay?: number | null;
  notes?: string | null;
  isActive?: boolean;
}

// ─── Recurrence math (client-safe, no dependencies) ─────────────────────────

/**
 * Given the current next_due_at and the recurrence interval, return the
 * next date after confirming/skipping the current occurrence.
 */
export function advanceNextDueAt(
  currentDueAt: Date,
  interval: RecurrenceInterval,
): Date {
  const d = new Date(currentDueAt);
  switch (interval) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "biweekly":
      d.setDate(d.getDate() + 14);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "annually":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}
