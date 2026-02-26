// Transitional wrapper during app-structure refactor.
// Canonical implementation lives in: src/features/contacts/server/*

"use server";

import { requireBusinessId } from "@/core/auth/tenant";
import type { CreateContactInput, UpdateContactInput } from "@/features/contacts/server";
import {
  createContact as _createContact,
  deleteContact as _deleteContact,
  getContact as _getContact,
  getContacts as _getContacts,
  updateContact as _updateContact,
} from "@/features/contacts/server";

export async function getContacts() {
  const businessId = await requireBusinessId();
  return _getContacts(businessId);
}

export async function getContact(id: string) {
  const businessId = await requireBusinessId();
  return _getContact(businessId, id);
}

export async function createContact(data: CreateContactInput) {
  const businessId = await requireBusinessId();
  return _createContact(businessId, data);
}

export async function updateContact(id: string, data: UpdateContactInput) {
  const businessId = await requireBusinessId();
  return _updateContact(businessId, id, data);
}

export async function deleteContact(id: string) {
  const businessId = await requireBusinessId();
  await _deleteContact(businessId, id);
}
