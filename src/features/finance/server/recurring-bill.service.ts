/**
 * Recurring bill service — orchestration layer.
 * Wraps repository calls with any cross-cutting concerns.
 */

import {
  listRecurringBills,
  getRecurringBill,
  createRecurringBill,
  updateRecurringBill,
  deleteRecurringBill,
  getPendingOccurrences,
  confirmOccurrence,
  skipOccurrence,
} from "./recurring-bill.repository";

import type {
  RecurringBillSummary,
  PendingBillOccurrence,
  CreateRecurringBillInput,
  UpdateRecurringBillInput,
} from "@/features/finance/shared/recurring-bill.contracts";

export type { RecurringBillSummary, PendingBillOccurrence };

export async function getBillsForBusiness(
  businessId: string,
): Promise<RecurringBillSummary[]> {
  return listRecurringBills(businessId);
}

export async function getBillById(
  businessId: string,
  billId: string,
): Promise<RecurringBillSummary | null> {
  return getRecurringBill(businessId, billId);
}

export async function addRecurringBill(
  businessId: string,
  input: CreateRecurringBillInput,
): Promise<RecurringBillSummary> {
  if (!input.name.trim()) throw new Error("Bill name is required");
  if (input.amount <= 0) throw new Error("Amount must be greater than zero");
  return createRecurringBill(businessId, input);
}

export async function editRecurringBill(
  businessId: string,
  input: UpdateRecurringBillInput,
): Promise<RecurringBillSummary> {
  if (input.amount !== undefined && input.amount <= 0) {
    throw new Error("Amount must be greater than zero");
  }
  return updateRecurringBill(businessId, input);
}

export async function removeRecurringBill(
  businessId: string,
  billId: string,
): Promise<void> {
  return deleteRecurringBill(businessId, billId);
}

export async function getDuePendingOccurrences(
  businessId: string,
): Promise<PendingBillOccurrence[]> {
  return getPendingOccurrences(businessId, new Date());
}

export async function confirmBillOccurrence(
  businessId: string,
  occurrenceId: string,
): Promise<{ financialTransactionId: string; nextOccurrenceId: string }> {
  return confirmOccurrence(businessId, occurrenceId, new Date());
}

export async function skipBillOccurrence(
  businessId: string,
  occurrenceId: string,
): Promise<{ nextOccurrenceId: string }> {
  return skipOccurrence(businessId, occurrenceId);
}
