"use server";

import { prisma } from "@/lib/prisma";

export async function getCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createCategory(name: string) {
  return prisma.category.create({
    data: { name: name.trim() },
  });
}

export async function getSuppliers() {
  return prisma.supplier.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createSupplier(name: string) {
  return prisma.supplier.create({
    data: { name: name.trim() },
  });
}
