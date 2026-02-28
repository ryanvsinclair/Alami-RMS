"use server";

import { requireBusinessMembership, requireRole } from "@/core/auth/tenant";
import { requireModule } from "@/core/modules/guard";
import {
  confirmLineItemMapping as _confirmLineItemMapping,
  confirmVendorMapping as _confirmVendorMapping,
  createVendorProfileForBusiness as _createVendorProfileForBusiness,
  getVendorProfiles as _getVendorProfiles,
  findOrCreateInboundAddress,
  getAddressDisplayString,
  updateVendorDefaults as _updateVendorDefaults,
  updateVendorTrustThreshold as _updateVendorTrustThreshold,
} from "@/features/documents/server";

export async function getInboundAddress() {
  const { business } = await requireBusinessMembership();
  await requireModule("documents");

  const inboundAddress = await findOrCreateInboundAddress(business.id);
  return {
    addressToken: inboundAddress.addressToken,
    isActive: inboundAddress.isActive,
    emailAddress: getAddressDisplayString(inboundAddress.addressToken),
  };
}

export async function getVendorProfiles() {
  const { business } = await requireBusinessMembership();
  await requireModule("documents");
  return _getVendorProfiles(business.id);
}

export async function createVendorProfile(payload: {
  vendorName: string;
  supplierId?: string | null;
  defaultCategoryId?: string | null;
  trustThresholdOverride?: number | null;
}) {
  const { business } = await requireBusinessMembership();
  await requireModule("documents");
  return _createVendorProfileForBusiness(business.id, payload);
}

export async function updateVendorTrustThreshold(
  vendorProfileId: string,
  threshold: number | null,
) {
  const { business, membership } = await requireBusinessMembership();
  await requireModule("documents");
  requireRole("manager", membership.role);
  return _updateVendorTrustThreshold(business.id, vendorProfileId, threshold);
}

export async function confirmVendorForDraft(draftId: string, vendorProfileId: string) {
  const { business } = await requireBusinessMembership();
  await requireModule("documents");
  return _confirmVendorMapping(business.id, draftId, vendorProfileId);
}

export async function updateVendorDefaults(
  vendorProfileId: string,
  defaults: { defaultCategoryId?: string | null; supplierId?: string | null },
) {
  const { business } = await requireBusinessMembership();
  await requireModule("documents");
  return _updateVendorDefaults(business.id, vendorProfileId, defaults);
}

export async function confirmLineItemMapping(
  vendorProfileId: string,
  rawName: string,
  inventoryItemId: string,
) {
  const { business } = await requireBusinessMembership();
  await requireModule("documents");
  return _confirmLineItemMapping(business.id, vendorProfileId, rawName, inventoryItemId);
}
