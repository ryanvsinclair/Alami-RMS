import { prisma } from "@/server/db/prisma";

function normalizeRawName(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) throw new Error("Raw line item name is required");
  return normalized;
}

export async function findMappingByLineItemName(
  businessId: string,
  vendorProfileId: string,
  rawName: string,
) {
  return prisma.documentVendorItemMapping.findFirst({
    where: {
      business_id: businessId,
      vendor_profile_id: vendorProfileId,
      raw_line_item_name: normalizeRawName(rawName),
    },
  });
}

export async function upsertItemMapping(
  businessId: string,
  vendorProfileId: string,
  rawName: string,
  inventoryItemId: string,
) {
  const normalizedName = normalizeRawName(rawName);

  const existing = await prisma.documentVendorItemMapping.findFirst({
    where: {
      business_id: businessId,
      vendor_profile_id: vendorProfileId,
      raw_line_item_name: normalizedName,
    },
    select: { id: true },
  });

  if (!existing) {
    return prisma.documentVendorItemMapping.create({
      data: {
        business_id: businessId,
        vendor_profile_id: vendorProfileId,
        raw_line_item_name: normalizedName,
        inventory_item_id: inventoryItemId,
        confirmed_count: 1,
      },
    });
  }

  return prisma.documentVendorItemMapping.update({
    where: { id: existing.id },
    data: {
      inventory_item_id: inventoryItemId,
      confirmed_count: { increment: 1 },
    },
  });
}

export async function findAllMappingsForVendor(
  businessId: string,
  vendorProfileId: string,
) {
  return prisma.documentVendorItemMapping.findMany({
    where: {
      business_id: businessId,
      vendor_profile_id: vendorProfileId,
    },
    orderBy: [{ raw_line_item_name: "asc" }],
  });
}
