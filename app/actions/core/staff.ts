// Transitional wrapper during app-structure refactor.
// Canonical implementation lives in: src/features/staff/server/*

"use server";

import { requireBusinessMembership, requireRole } from "@/core/auth/tenant";
import {
  acceptStaffInviteAction as _acceptStaffInviteAction,
  createStaffInviteForBusiness,
  getInviteByToken as _getInviteByToken,
  getPendingInvitesForBusiness,
  getStaffMembersForBusiness,
  revokeStaffInviteForBusiness,
} from "@/features/staff/server";

export async function getStaffMembers() {
  const { business } = await requireBusinessMembership();
  return getStaffMembersForBusiness(business.id);
}

export async function getPendingInvites() {
  const { business, membership } = await requireBusinessMembership();
  requireRole("owner", membership.role);
  return getPendingInvitesForBusiness(business.id);
}

export async function createStaffInvite(formData: FormData) {
  const { user, business, membership } = await requireBusinessMembership();
  requireRole("owner", membership.role);

  return createStaffInviteForBusiness({
    businessId: business.id,
    invitedByUserId: user.id,
    formData,
  });
}

export async function revokeStaffInvite(inviteId: string) {
  const { business, membership } = await requireBusinessMembership();
  requireRole("owner", membership.role);
  await revokeStaffInviteForBusiness(business.id, inviteId);
}

export async function getInviteByToken(token: string) {
  return _getInviteByToken(token);
}

export async function acceptStaffInviteAction(formData: FormData) {
  return _acceptStaffInviteAction(formData);
}
