/**
 * Contacts service layer.
 * Preserves current action behavior while isolating repository access.
 */

import { serialize } from "@/domain/shared/serialize";
import {
  createContactRecord,
  deleteContactForBusiness,
  findContactById,
  findContacts,
  updateContactForBusiness,
} from "./contacts.repository";

export interface CreateContactInput {
  name: string;
  company?: string;
  role?: string;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
}

export interface UpdateContactInput {
  name?: string;
  company?: string | null;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  notes?: string | null;
}

function normalizeCreateField(value?: string) {
  return value?.trim() || null;
}

function normalizeUpdateField(value?: string | null) {
  if (value === undefined) return undefined;
  return value?.trim() || null;
}

export async function getContacts(businessId: string) {
  const rows = await findContacts(businessId);
  return serialize(rows);
}

export async function getContact(businessId: string, id: string) {
  const contact = await findContactById(id, businessId);
  return contact ? serialize(contact) : null;
}

export async function createContact(businessId: string, data: CreateContactInput) {
  const contact = await createContactRecord({
    businessId,
    data: {
      name: data.name.trim(),
      company: normalizeCreateField(data.company),
      role: normalizeCreateField(data.role),
      phone: normalizeCreateField(data.phone),
      email: normalizeCreateField(data.email),
      website: normalizeCreateField(data.website),
      notes: normalizeCreateField(data.notes),
    },
  });
  return serialize(contact);
}

export async function updateContact(
  businessId: string,
  id: string,
  data: UpdateContactInput,
) {
  return updateContactForBusiness(id, businessId, {
    name: data.name?.trim(),
    company: normalizeUpdateField(data.company),
    role: normalizeUpdateField(data.role),
    phone: normalizeUpdateField(data.phone),
    email: normalizeUpdateField(data.email),
    website: normalizeUpdateField(data.website),
    notes: normalizeUpdateField(data.notes),
  });
}

export async function deleteContact(businessId: string, id: string) {
  await deleteContactForBusiness(id, businessId);
}
