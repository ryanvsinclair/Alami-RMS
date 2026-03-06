import { prisma } from "@/core/prisma";
import { serialize } from "@/core/utils/serialize";
import type {
  RecurringBillCategory,
  RecurrenceInterval,
  RecurringBillSummary,
  PendingBillOccurrence,
  CreateRecurringBillInput,
  UpdateRecurringBillInput,
} from "@/features/finance/shared/recurring-bill.contracts";
import { advanceNextDueAt } from "@/features/finance/shared/recurring-bill.contracts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v) || 0;
  if (
    typeof v === "object" &&
    "toNumber" in (v as object) &&
    typeof (v as { toNumber: unknown }).toNumber === "function"
  ) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return 0;
}

function mapBill(row: {
  id: string;
  name: string;
  amount: unknown;
  category: string;
  recurrence: string;
  recurrence_day: number | null;
  next_due_at: Date;
  started_at: Date;
  is_active: boolean;
  notes: string | null;
  created_at: Date;
}): RecurringBillSummary {
  return {
    id: row.id,
    name: row.name,
    amount: toNumber(row.amount),
    category: row.category as RecurringBillCategory,
    recurrence: row.recurrence as RecurrenceInterval,
    recurrenceDay: row.recurrence_day,
    nextDueAt: row.next_due_at.toISOString(),
    startedAt: row.started_at.toISOString(),
    isActive: row.is_active,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
  };
}

function mapOccurrence(row: {
  id: string;
  bill_id: string;
  due_at: Date;
  status: string;
  bill: { name: string; amount: unknown; category: string; recurrence: string };
}): PendingBillOccurrence {
  return {
    id: row.id,
    billId: row.bill_id,
    billName: row.bill.name,
    amount: toNumber(row.bill.amount),
    category: row.bill.category as RecurringBillCategory,
    recurrence: row.bill.recurrence as RecurrenceInterval,
    dueAt: row.due_at.toISOString(),
    status: row.status as PendingBillOccurrence["status"],
  };
}

// ─── Bills ───────────────────────────────────────────────────────────────────

export async function listRecurringBills(businessId: string): Promise<RecurringBillSummary[]> {
  const rows = await prisma.recurringBill.findMany({
    where: { business_id: businessId },
    orderBy: [{ is_active: "desc" }, { next_due_at: "asc" }],
  });
  return rows.map(mapBill);
}

export async function getRecurringBill(
  businessId: string,
  billId: string,
): Promise<RecurringBillSummary | null> {
  const row = await prisma.recurringBill.findFirst({
    where: { id: billId, business_id: businessId },
  });
  return row ? mapBill(row) : null;
}

export async function createRecurringBill(
  businessId: string,
  input: CreateRecurringBillInput,
): Promise<RecurringBillSummary> {
  const startedAt = new Date(input.startedAt);

  // next_due_at starts as the started_at date itself (first occurrence).
  const row = await prisma.recurringBill.create({
    data: {
      business_id: businessId,
      name: input.name,
      amount: input.amount,
      category: input.category,
      recurrence: input.recurrence,
      recurrence_day: input.recurrenceDay ?? null,
      next_due_at: startedAt,
      started_at: startedAt,
      notes: input.notes ?? null,
    },
  });

  // Immediately generate the first pending occurrence so it surfaces on the dashboard.
  await prisma.recurringBillOccurrence.create({
    data: {
      business_id: businessId,
      bill_id: row.id,
      due_at: startedAt,
      status: "pending",
    },
  });

  return mapBill(row);
}

export async function updateRecurringBill(
  businessId: string,
  input: UpdateRecurringBillInput,
): Promise<RecurringBillSummary> {
  const row = await prisma.recurringBill.update({
    where: { id: input.id, business_id: businessId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.recurrence !== undefined ? { recurrence: input.recurrence } : {}),
      ...(input.recurrenceDay !== undefined
        ? { recurrence_day: input.recurrenceDay }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    },
  });
  return mapBill(row);
}

export async function deleteRecurringBill(
  businessId: string,
  billId: string,
): Promise<void> {
  await prisma.recurringBill.delete({
    where: { id: billId, business_id: businessId },
  });
}

// ─── Occurrences ─────────────────────────────────────────────────────────────

/**
 * Returns all pending occurrences due on or before `asOf` for the business.
 * Used by the home dashboard to show confirm cards.
 */
export async function getPendingOccurrences(
  businessId: string,
  asOf: Date = new Date(),
): Promise<PendingBillOccurrence[]> {
  const rows = await prisma.recurringBillOccurrence.findMany({
    where: {
      business_id: businessId,
      status: "pending",
      due_at: { lte: asOf },
    },
    orderBy: { due_at: "asc" },
    include: {
      bill: {
        select: { name: true, amount: true, category: true, recurrence: true },
      },
    },
  });
  return rows.map(mapOccurrence);
}

/**
 * Confirm an occurrence — writes a FinancialTransaction, links it, updates
 * the occurrence to confirmed, and generates the next pending occurrence.
 * Returns the serialized FinancialTransaction id.
 */
export async function confirmOccurrence(
  businessId: string,
  occurrenceId: string,
  occurredAt: Date = new Date(),
): Promise<{ financialTransactionId: string; nextOccurrenceId: string }> {
  return prisma.$transaction(async (tx) => {
    const occurrence = await tx.recurringBillOccurrence.findFirst({
      where: { id: occurrenceId, business_id: businessId, status: "pending" },
      include: {
        bill: true,
      },
    });

    if (!occurrence) {
      throw new Error("Occurrence not found or already actioned");
    }

    const bill = occurrence.bill;

    // Write the financial transaction
    const ft = await tx.financialTransaction.create({
      data: {
        business_id: businessId,
        type: "expense",
        source: "recurring_bill",
        amount: bill.amount,
        description: bill.name,
        occurred_at: occurredAt,
        metadata: {
          recurring_bill_id: bill.id,
          recurring_bill_occurrence_id: occurrenceId,
          category: bill.category,
          recurrence: bill.recurrence,
        },
      },
    });

    // Mark occurrence confirmed and link transaction
    await tx.recurringBillOccurrence.update({
      where: { id: occurrenceId },
      data: {
        status: "confirmed",
        confirmed_at: occurredAt,
        financial_transaction_id: ft.id,
      },
    });

    // Advance next_due_at on the bill
    const nextDueAt = advanceNextDueAt(occurrence.due_at, bill.recurrence as RecurrenceInterval);
    await tx.recurringBill.update({
      where: { id: bill.id },
      data: { next_due_at: nextDueAt },
    });

    // Generate next pending occurrence
    const nextOccurrence = await tx.recurringBillOccurrence.create({
      data: {
        business_id: businessId,
        bill_id: bill.id,
        due_at: nextDueAt,
        status: "pending",
      },
    });

    return {
      financialTransactionId: ft.id,
      nextOccurrenceId: nextOccurrence.id,
    };
  });
}

/**
 * Skip an occurrence without posting a transaction.
 * Still advances next_due_at and generates the next pending occurrence.
 */
export async function skipOccurrence(
  businessId: string,
  occurrenceId: string,
): Promise<{ nextOccurrenceId: string }> {
  return prisma.$transaction(async (tx) => {
    const occurrence = await tx.recurringBillOccurrence.findFirst({
      where: { id: occurrenceId, business_id: businessId, status: "pending" },
      include: { bill: true },
    });

    if (!occurrence) {
      throw new Error("Occurrence not found or already actioned");
    }

    const bill = occurrence.bill;

    await tx.recurringBillOccurrence.update({
      where: { id: occurrenceId },
      data: { status: "skipped" },
    });

    const nextDueAt = advanceNextDueAt(occurrence.due_at, bill.recurrence as RecurrenceInterval);

    await tx.recurringBill.update({
      where: { id: bill.id },
      data: { next_due_at: nextDueAt },
    });

    const nextOccurrence = await tx.recurringBillOccurrence.create({
      data: {
        business_id: businessId,
        bill_id: bill.id,
        due_at: nextDueAt,
        status: "pending",
      },
    });

    return { nextOccurrenceId: nextOccurrence.id };
  });
}

export { serialize };
