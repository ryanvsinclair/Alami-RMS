"use server";

import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils/serialize";
import { requireRestaurantId } from "@/lib/auth/tenant";

export async function getCategories() {
  const restaurantId = await requireRestaurantId();
  const rows = await prisma.category.findMany({
    where: { restaurant_id: restaurantId },
    orderBy: { name: "asc" },
  });
  return serialize(rows);
}

export async function createCategory(name: string) {
  const restaurantId = await requireRestaurantId();
  const cat = await prisma.category.create({
    data: { restaurant_id: restaurantId, name: name.trim() },
  });
  return serialize(cat);
}

export async function getSuppliers() {
  const restaurantId = await requireRestaurantId();
  const rows = await prisma.supplier.findMany({
    where: { restaurant_id: restaurantId },
    orderBy: { name: "asc" },
  });
  return serialize(rows);
}

export async function createSupplier(name: string) {
  const restaurantId = await requireRestaurantId();
  const supplier = await prisma.supplier.create({
    data: { restaurant_id: restaurantId, name: name.trim() },
  });
  return serialize(supplier);
}
