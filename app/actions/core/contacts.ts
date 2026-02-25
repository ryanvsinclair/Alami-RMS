"use server";

import { prisma } from "@/core/prisma";
import { serialize } from "@/core/utils/serialize";
import { requireBusinessId } from "@/core/auth/tenant";

export async function getContacts() {
  const businessId = await requireBusinessId();
  const rows = await prisma.contact.findMany({
    where: { business_id: businessId },
    orderBy: { name: "asc" },
  });
  return serialize(rows);
}

export async function getContact(id: string) {
  const businessId = await requireBusinessId();
  const contact = await prisma.contact.findFirst({
    where: { id, business_id: businessId },
  });
  return contact ? serialize(contact) : null;
}

export async function createContact(data: {
  name: string;
  company?: string;
  role?: string;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
}) {
  const businessId = await requireBusinessId();
  const contact = await prisma.contact.create({
    data: {
      business_id: businessId,
      name: data.name.trim(),
      company: data.company?.trim() || null,
      role: data.role?.trim() || null,
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      website: data.website?.trim() || null,
      notes: data.notes?.trim() || null,
    },
  });
  return serialize(contact);
}

export async function updateContact(
  id: string,
  data: {
    name?: string;
    company?: string | null;
    role?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    notes?: string | null;
  }
) {
  const businessId = await requireBusinessId();
  const contact = await prisma.contact.updateMany({
    where: { id, business_id: businessId },
    data: {
      name: data.name?.trim(),
      company: data.company === undefined ? undefined : data.company?.trim() || null,
      role: data.role === undefined ? undefined : data.role?.trim() || null,
      phone: data.phone === undefined ? undefined : data.phone?.trim() || null,
      email: data.email === undefined ? undefined : data.email?.trim() || null,
      website: data.website === undefined ? undefined : data.website?.trim() || null,
      notes: data.notes === undefined ? undefined : data.notes?.trim() || null,
    },
  });
  return contact;
}

export async function deleteContact(id: string) {
  const businessId = await requireBusinessId();
  await prisma.contact.deleteMany({
    where: { id, business_id: businessId },
  });
}
