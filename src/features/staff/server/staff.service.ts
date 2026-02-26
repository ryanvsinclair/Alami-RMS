/**
 * Staff service layer.
 * Preserves action behavior while isolating persistence and invite workflows.
 */

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { requireSupabaseUser } from "@/server/auth/server";
import { serialize } from "@/core/utils/serialize";
import type { BusinessRole } from "@/lib/generated/prisma/client";
import {
  acceptInviteMembership,
  createBusinessInviteRecord,
  expirePendingInvitesForBusiness,
  findActivePendingInviteByEmail,
  findInviteWithBusinessNameByToken,
  findInvitesForBusiness,
  findPendingInviteByToken,
  findStaffMembersByBusiness,
  revokePendingInviteForBusiness,
  updateInviteStatus,
} from "./staff.repository";

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

export async function getStaffMembersForBusiness(businessId: string) {
  const rows = await findStaffMembersByBusiness(businessId);
  return serialize(rows);
}

export async function getPendingInvitesForBusiness(businessId: string) {
  const now = new Date();
  await expirePendingInvitesForBusiness(businessId, now);

  const rows = await findInvitesForBusiness(businessId);
  return serialize(rows);
}

export async function createStaffInviteForBusiness(input: {
  businessId: string;
  invitedByUserId: string;
  formData: FormData;
}) {
  const email = String(input.formData.get("email") ?? "").trim().toLowerCase();
  const role = String(input.formData.get("role") ?? "staff") as BusinessRole;

  if (!email || !email.includes("@")) {
    throw new Error("Valid email is required");
  }
  if (!["manager", "staff"].includes(role)) {
    throw new Error("Invalid role");
  }

  const now = new Date();
  const existingPending = await findActivePendingInviteByEmail(input.businessId, email, now);

  if (existingPending) {
    return {
      invite: serialize(existingPending),
      invite_url: `${appBaseUrl()}/auth/accept-invite?token=${existingPending.token}`,
    };
  }

  const token = randomUUID();
  const invite = await createBusinessInviteRecord({
    businessId: input.businessId,
    email,
    role,
    token,
    invitedByUserId: input.invitedByUserId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return {
    invite: serialize(invite),
    invite_url: `${appBaseUrl()}/auth/accept-invite?token=${token}`,
  };
}

export async function revokeStaffInviteForBusiness(businessId: string, inviteId: string) {
  await revokePendingInviteForBusiness(inviteId, businessId);
}

export async function getInviteByToken(token: string) {
  const invite = await findInviteWithBusinessNameByToken(token);

  if (!invite) return null;

  if (invite.status === "pending" && invite.expires_at < new Date()) {
    await updateInviteStatus(invite.id, "expired");
    return {
      ...serialize(invite),
      status: "expired",
    };
  }

  return serialize(invite);
}

export async function acceptStaffInviteAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const encodedToken = encodeURIComponent(token);

  if (!token) {
    redirect("/auth/login");
  }

  let user;
  try {
    user = await requireSupabaseUser();
  } catch {
    redirect(`/auth/login?next=${encodeURIComponent(`/auth/accept-invite?token=${encodedToken}`)}`);
  }

  const invite = await findPendingInviteByToken(token);

  if (!invite) {
    redirect(
      `/auth/accept-invite?token=${encodedToken}&error=${encodeURIComponent(
        "Invite is invalid or no longer active",
      )}`,
    );
  }

  if (invite.expires_at < new Date()) {
    await updateInviteStatus(invite.id, "expired");
    redirect(
      `/auth/accept-invite?token=${encodedToken}&error=${encodeURIComponent("Invite has expired")}`,
    );
  }

  const email = user.email?.toLowerCase() ?? "";
  if (!email || email !== invite.email.toLowerCase()) {
    redirect(
      `/auth/accept-invite?token=${encodedToken}&error=${encodeURIComponent(
        `Sign in as ${invite.email} to accept this invite`,
      )}`,
    );
  }

  await acceptInviteMembership({
    userId: user.id,
    inviteId: invite.id,
    businessId: invite.business_id,
    role: invite.role,
  });

  redirect("/");
}
