"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/core/prisma";
import { serialize } from "@/core/utils/serialize";
import { requireBusinessMembership, requireRole } from "@/core/auth/tenant";
import { requireSupabaseUser } from "@/core/auth/server";
import type { BusinessRole } from "@/lib/generated/prisma/client";

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

export async function getStaffMembers() {
  const { business } = await requireBusinessMembership();

  const rows = await prisma.userBusiness.findMany({
    where: { business_id: business.id },
    orderBy: { created_at: "asc" },
  });

  return serialize(rows);
}

export async function getPendingInvites() {
  const { business, membership } = await requireBusinessMembership();
  requireRole("owner", membership.role);

  const now = new Date();
  await prisma.businessInvite.updateMany({
    where: {
      business_id: business.id,
      status: "pending",
      expires_at: { lt: now },
    },
    data: { status: "expired" },
  });

  const rows = await prisma.businessInvite.findMany({
    where: { business_id: business.id },
    orderBy: { created_at: "desc" },
    take: 25,
  });

  return serialize(rows);
}

export async function createStaffInvite(formData: FormData) {
  const { user, business, membership } = await requireBusinessMembership();
  requireRole("owner", membership.role);

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "staff") as BusinessRole;

  if (!email || !email.includes("@")) {
    throw new Error("Valid email is required");
  }
  if (!["manager", "staff"].includes(role)) {
    throw new Error("Invalid role");
  }

  const existingPending = await prisma.businessInvite.findFirst({
    where: {
      business_id: business.id,
      email,
      status: "pending",
      expires_at: { gt: new Date() },
    },
  });

  if (existingPending) {
    return {
      invite: serialize(existingPending),
      invite_url: `${appBaseUrl()}/auth/accept-invite?token=${existingPending.token}`,
    };
  }

  const token = randomUUID();
  const invite = await prisma.businessInvite.create({
    data: {
      business_id: business.id,
      email,
      role,
      token,
      invited_by_user_id: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    invite: serialize(invite),
    invite_url: `${appBaseUrl()}/auth/accept-invite?token=${token}`,
  };
}

export async function revokeStaffInvite(inviteId: string) {
  const { business, membership } = await requireBusinessMembership();
  requireRole("owner", membership.role);

  await prisma.businessInvite.updateMany({
    where: {
      id: inviteId,
      business_id: business.id,
      status: "pending",
    },
    data: { status: "revoked" },
  });
}

export async function getInviteByToken(token: string) {
  const invite = await prisma.businessInvite.findFirst({
    where: { token },
    include: { business: { select: { name: true } } },
  });

  if (!invite) return null;

  if (invite.status === "pending" && invite.expires_at < new Date()) {
    await prisma.businessInvite.update({
      where: { id: invite.id },
      data: { status: "expired" },
    });
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

  const invite = await prisma.businessInvite.findFirst({
    where: { token, status: "pending" },
  });

  if (!invite) {
    redirect(`/auth/accept-invite?token=${encodedToken}&error=${encodeURIComponent("Invite is invalid or no longer active")}`);
  }

  if (invite.expires_at < new Date()) {
    await prisma.businessInvite.update({
      where: { id: invite.id },
      data: { status: "expired" },
    });
    redirect(`/auth/accept-invite?token=${encodedToken}&error=${encodeURIComponent("Invite has expired")}`);
  }

  const email = user.email?.toLowerCase() ?? "";
  if (!email || email !== invite.email.toLowerCase()) {
    redirect(
      `/auth/accept-invite?token=${encodedToken}&error=${encodeURIComponent(
        `Sign in as ${invite.email} to accept this invite`
      )}`
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.userBusiness.upsert({
      where: {
        user_id_business_id: {
          user_id: user.id,
          business_id: invite.business_id,
        },
      },
      create: {
        user_id: user.id,
        business_id: invite.business_id,
        role: invite.role,
      },
      update: {
        role: invite.role,
      },
    });

    await tx.businessInvite.update({
      where: { id: invite.id },
      data: {
        status: "accepted",
        accepted_at: new Date(),
      },
    });
  });

  redirect("/");
}
