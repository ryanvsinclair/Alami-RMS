"use server";

import { prisma } from "@/core/prisma";
import { serialize } from "@/core/utils/serialize";
import { requireBusinessId } from "@/core/auth/tenant";

export async function getCategories() {
  const businessId = await requireBusinessId();
  const rows = await prisma.category.findMany({
    where: { business_id: businessId },
    orderBy: { name: "asc" },
  });
  return serialize(rows);
}

export async function createCategory(name: string) {
  const businessId = await requireBusinessId();
  const cat = await prisma.category.create({
    data: { business_id: businessId, name: name.trim() },
  });
  return serialize(cat);
}

export async function getSuppliers() {
  const businessId = await requireBusinessId();
  const rows = await prisma.supplier.findMany({
    where: { business_id: businessId },
    orderBy: { name: "asc" },
  });
  return serialize(rows);
}

export async function createSupplier(name: string) {
  const businessId = await requireBusinessId();
  const supplier = await prisma.supplier.create({
    data: { business_id: businessId, name: name.trim() },
  });
  return serialize(supplier);
}
