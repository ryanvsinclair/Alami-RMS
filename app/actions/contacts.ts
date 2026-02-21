"use server";

import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils/serialize";
import { requireRestaurantId } from "@/lib/auth/tenant";

export async function getContacts() {
  const restaurantId = await requireRestaurantId();
  const rows = await prisma.contact.findMany({
    where: { restaurant_id: restaurantId },
    orderBy: { name: "asc" },
  });
  return serialize(rows);
}

export async function getContact(id: string) {
  const restaurantId = await requireRestaurantId();
  const contact = await prisma.contact.findFirst({
    where: { id, restaurant_id: restaurantId },
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
  const restaurantId = await requireRestaurantId();
  const contact = await prisma.contact.create({
    data: {
      restaurant_id: restaurantId,
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
  const restaurantId = await requireRestaurantId();
  const contact = await prisma.contact.updateMany({
    where: { id, restaurant_id: restaurantId },
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
  const restaurantId = await requireRestaurantId();
  await prisma.contact.deleteMany({
    where: { id, restaurant_id: restaurantId },
  });
}
