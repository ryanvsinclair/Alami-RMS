"use server";

import { requireBusinessId } from "@/core/auth/tenant";
import { serialize } from "@/core/utils/serialize";
import {
  getBillsForBusiness,
  addRecurringBill,
  editRecurringBill,
  removeRecurringBill,
  getDuePendingOccurrences,
  confirmBillOccurrence,
  skipBillOccurrence,
} from "@/features/finance/server/recurring-bill.service";
import type {
  CreateRecurringBillInput,
  UpdateRecurringBillInput,
} from "@/features/finance/shared/recurring-bill.contracts";

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getRecurringBillsAction() {
  const businessId = await requireBusinessId();
  const bills = await getBillsForBusiness(businessId);
  return serialize(bills);
}

export async function getPendingBillOccurrencesAction() {
  const businessId = await requireBusinessId();
  const occurrences = await getDuePendingOccurrences(businessId);
  return serialize(occurrences);
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createRecurringBillAction(input: CreateRecurringBillInput) {
  const businessId = await requireBusinessId();
  const bill = await addRecurringBill(businessId, input);
  return serialize(bill);
}

export async function updateRecurringBillAction(input: UpdateRecurringBillInput) {
  const businessId = await requireBusinessId();
  const bill = await editRecurringBill(businessId, input);
  return serialize(bill);
}

export async function deleteRecurringBillAction(billId: string) {
  const businessId = await requireBusinessId();
  await removeRecurringBill(businessId, billId);
  return { success: true };
}

export async function confirmBillOccurrenceAction(occurrenceId: string) {
  const businessId = await requireBusinessId();
  const result = await confirmBillOccurrence(businessId, occurrenceId);
  return serialize(result);
}

export async function skipBillOccurrenceAction(occurrenceId: string) {
  const businessId = await requireBusinessId();
  const result = await skipBillOccurrence(businessId, occurrenceId);
  return serialize(result);
}
