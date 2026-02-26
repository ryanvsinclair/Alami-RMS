/**
 * Staff repository layer.
 * Isolates Prisma access for staff membership and invite workflows.
 */

import { prisma } from "@/server/db/prisma";
import type { BusinessRole } from "@/lib/generated/prisma/client";

export async function findStaffMembersByBusiness(businessId: string) {
  return prisma.userBusiness.findMany({
    where: { business_id: businessId },
    orderBy: { created_at: "asc" },
  });
}

export async function expirePendingInvitesForBusiness(businessId: string, now: Date) {
  return prisma.businessInvite.updateMany({
    where: {
      business_id: businessId,
      status: "pending",
      expires_at: { lt: now },
    },
    data: { status: "expired" },
  });
}

export async function findInvitesForBusiness(businessId: string) {
  return prisma.businessInvite.findMany({
    where: { business_id: businessId },
    orderBy: { created_at: "desc" },
    take: 25,
  });
}

export async function findActivePendingInviteByEmail(
  businessId: string,
  email: string,
  now: Date,
) {
  return prisma.businessInvite.findFirst({
    where: {
      business_id: businessId,
      email,
      status: "pending",
      expires_at: { gt: now },
    },
  });
}

export async function createBusinessInviteRecord(input: {
  businessId: string;
  email: string;
  role: BusinessRole;
  token: string;
  invitedByUserId: string;
  expiresAt: Date;
}) {
  return prisma.businessInvite.create({
    data: {
      business_id: input.businessId,
      email: input.email,
      role: input.role,
      token: input.token,
      invited_by_user_id: input.invitedByUserId,
      expires_at: input.expiresAt,
    },
  });
}

export async function revokePendingInviteForBusiness(inviteId: string, businessId: string) {
  return prisma.businessInvite.updateMany({
    where: {
      id: inviteId,
      business_id: businessId,
      status: "pending",
    },
    data: { status: "revoked" },
  });
}

export async function findInviteWithBusinessNameByToken(token: string) {
  return prisma.businessInvite.findFirst({
    where: { token },
    include: { business: { select: { name: true } } },
  });
}

export async function findPendingInviteByToken(token: string) {
  return prisma.businessInvite.findFirst({
    where: { token, status: "pending" },
  });
}

export async function updateInviteStatus(
  inviteId: string,
  status: "expired" | "accepted" | "revoked",
  acceptedAt?: Date,
) {
  return prisma.businessInvite.update({
    where: { id: inviteId },
    data: {
      status,
      accepted_at: acceptedAt,
    },
  });
}

export async function acceptInviteMembership(input: {
  userId: string;
  inviteId: string;
  businessId: string;
  role: BusinessRole;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.userBusiness.upsert({
      where: {
        user_id_business_id: {
          user_id: input.userId,
          business_id: input.businessId,
        },
      },
      create: {
        user_id: input.userId,
        business_id: input.businessId,
        role: input.role,
      },
      update: {
        role: input.role,
      },
    });

    await tx.businessInvite.update({
      where: { id: input.inviteId },
      data: {
        status: "accepted",
        accepted_at: new Date(),
      },
    });
  });
}
