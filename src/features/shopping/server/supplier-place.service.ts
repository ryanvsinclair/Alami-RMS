/**
 * Supplier upsert from Google Place selection.
 * Handles matching by google_place_id or name, creating new suppliers as needed.
 */

import { prisma } from "@/server/db/prisma";
import type { SelectedGooglePlace } from "./contracts";

export async function upsertSupplierFromGooglePlace(
  place: SelectedGooglePlace,
  businessId: string
) {
  const existing = await prisma.supplier.findFirst({
    where: { business_id: businessId, google_place_id: place.place_id },
  });

  if (existing) {
    return prisma.supplier.update({
      where: { id: existing.id },
      data: {
        name: place.name,
        formatted_address: place.formatted_address,
        latitude: place.lat,
        longitude: place.lng,
      },
    });
  }

  const nameMatch = await prisma.supplier.findMany({
    where: {
      business_id: businessId,
      name: { equals: place.name, mode: "insensitive" },
    },
    take: 1,
  });
  if (nameMatch[0]) {
    return prisma.supplier.update({
      where: { id: nameMatch[0].id },
      data: {
        google_place_id: place.place_id,
        formatted_address: place.formatted_address,
        latitude: place.lat,
        longitude: place.lng,
      },
    });
  }

  return prisma.supplier.create({
    data: {
      business_id: businessId,
      name: place.name,
      google_place_id: place.place_id,
      formatted_address: place.formatted_address,
      latitude: place.lat,
      longitude: place.lng,
    },
  });
}
