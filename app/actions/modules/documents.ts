"use server";

import { requireBusinessMembership, requireRole } from "@/core/auth/tenant";
import { requireModule } from "@/core/modules/guard";
import {
  blockVendor as _blockVendor,
  confirmLineItemMapping as _confirmLineItemMapping,
  confirmVendorMapping as _confirmVendorMapping,
  createVendorProfileForBusiness as _createVendorProfileForBusiness,
  disableAutoPost as _disableAutoPost,
  getDraftDetail as _getDraftDetail,
  getDraftDocumentUrl as _getDraftDocumentUrl,
  getDraftInbox as _getDraftInbox,
  getDraftInboxBadgeCount as _getDraftInboxBadgeCount,
  getCogsSummary as _getCogsSummary,
  getPriceTrends as _getPriceTrends,
  getReorderSignals as _getReorderSignals,
  getTaxSummary as _getTaxSummary,
  getVendorSpendSummary as _getVendorSpendSummary,
  getVendorProfiles as _getVendorProfiles,
  findOrCreateInboundAddress,
  getAddressDisplayString,
  postDraft as _postDraft,
  rejectDraft as _rejectDraft,
  updateVendorDefaults as _updateVendorDefaults,
  updateVendorTrustThreshold as _updateVendorTrustThreshold,
} from "@/features/documents/server";
import type { DocumentDraftStatus } from "@/features/documents/shared";

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

export async function getDraftInbox(filters: {
  page?: number;
  pageSize?: number;
  statusFilter?: DocumentDraftStatus | "all";
} = {}) {
  const { business } = await requireBusinessMembership();
  await requireModule("documents");
  return _getDraftInbox(business.id, filters);
}

export async function getDraftInboxBadgeCount() {
  const { business } = await requireBusinessMembership();
  await requireModule("documents");
  return _getDraftInboxBadgeCount(business.id);
}

export async function getDraftDetail(draftId: string) {
  const { business, membership } = await requireBusinessMembership();
  await requireModule("documents");
  const detail = await _getDraftDetail(business.id, draftId);
  if (!detail) return null;

  return {
    ...detail,
    canManageTrustThreshold:
      membership.role === "owner" || membership.role === "manager",
  };
}

export async function getDraftDocumentUrl(draftId: string) {
  const { business } = await requireBusinessMembership();
  await requireModule("documents");
  return _getDraftDocumentUrl(business.id, draftId);
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

export async function postDraft(draftId: string) {
  const { business, user } = await requireBusinessMembership();
  await requireModule("documents");
  return _postDraft(business.id, draftId, user.id, { autoPosted: false });
}

export async function rejectDraft(draftId: string) {
  const { business, user } = await requireBusinessMembership();
  await requireModule("documents");
  return _rejectDraft(business.id, draftId, user.id);
}

export async function disableAutoPost(vendorProfileId: string) {
  const { business, membership } = await requireBusinessMembership();
  await requireModule("documents");
  requireRole("manager", membership.role);
  return _disableAutoPost(business.id, vendorProfileId);
}

export async function blockVendor(vendorProfileId: string) {
  const { business, membership } = await requireBusinessMembership();
  await requireModule("documents");
  requireRole("manager", membership.role);
  return _blockVendor(business.id, vendorProfileId);
}

export async function getVendorSpendSummary(options: {
  period?: { days?: 30 | 60 | 90; startDate?: string; endDate?: string };
} = {}) {
  const { business } = await requireBusinessMembership();
  await requireModule("documents");
  return _getVendorSpendSummary(business.id, options);
}

export async function getPriceTrends(
  vendorProfileId: string,
  options: {
    period?: { days?: 30 | 60 | 90; startDate?: string; endDate?: string };
    inventoryItemId?: string;
    rawLineItemName?: string;
  } = {},
) {
  const { business } = await requireBusinessMembership();
  await requireModule("documents");
  return _getPriceTrends(business.id, vendorProfileId, options);
}

export async function getReorderSignals() {
  const { business } = await requireBusinessMembership();
  await requireModule("documents");
  return _getReorderSignals(business.id);
}

export async function getTaxSummary(options: {
  period?: { days?: 30 | 60 | 90; startDate?: string; endDate?: string };
} = {}) {
  const { business } = await requireBusinessMembership();
  await requireModule("documents");
  return _getTaxSummary(business.id, options);
}

export async function getCogsSummary(options: {
  period?: { days?: 30 | 60 | 90; startDate?: string; endDate?: string };
} = {}) {
  const { business } = await requireBusinessMembership();
  await requireModule("documents");
  return _getCogsSummary(business.id, options);
}
