/**
 * Contacts repository layer.
 * Isolates Prisma access for contacts feature extraction.
 */

import { prisma } from "@/server/db/prisma";

export interface CreateContactRecordInput {
  businessId: string;
  data: {
    name: string;
    company?: string | null;
    role?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    notes?: string | null;
  };
}

export interface UpdateContactRecordInput {
  name?: string;
  company?: string | null;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  notes?: string | null;
}

export async function findContacts(businessId: string) {
  return prisma.contact.findMany({
    where: { business_id: businessId },
    orderBy: { name: "asc" },
  });
}

export async function findContactById(id: string, businessId: string) {
  return prisma.contact.findFirst({
    where: { id, business_id: businessId },
  });
}

export async function createContactRecord(input: CreateContactRecordInput) {
  return prisma.contact.create({
    data: {
      business_id: input.businessId,
      ...input.data,
    },
  });
}

export async function updateContactForBusiness(
  id: string,
  businessId: string,
  data: UpdateContactRecordInput,
) {
  return prisma.contact.updateMany({
    where: { id, business_id: businessId },
    data,
  });
}

export async function deleteContactForBusiness(id: string, businessId: string) {
  return prisma.contact.deleteMany({
    where: { id, business_id: businessId },
  });
}
