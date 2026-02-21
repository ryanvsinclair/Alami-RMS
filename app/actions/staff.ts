"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils/serialize";
import { requireRestaurantMembership, requireRole } from "@/lib/auth/tenant";
import { requireSupabaseUser } from "@/lib/auth/server";
import type { RestaurantRole } from "@/lib/generated/prisma/client";

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

export async function getStaffMembers() {
  const { restaurant } = await requireRestaurantMembership();

  const rows = await prisma.userRestaurant.findMany({
    where: { restaurant_id: restaurant.id },
    orderBy: { created_at: "asc" },
  });

  return serialize(rows);
}

export async function getPendingInvites() {
  const { restaurant, membership } = await requireRestaurantMembership();
  requireRole("owner", membership.role);

  const now = new Date();
  await prisma.restaurantInvite.updateMany({
    where: {
      restaurant_id: restaurant.id,
      status: "pending",
      expires_at: { lt: now },
    },
    data: { status: "expired" },
  });

  const rows = await prisma.restaurantInvite.findMany({
    where: { restaurant_id: restaurant.id },
    orderBy: { created_at: "desc" },
    take: 25,
  });

  return serialize(rows);
}

export async function createStaffInvite(formData: FormData) {
  const { user, restaurant, membership } = await requireRestaurantMembership();
  requireRole("owner", membership.role);

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "staff") as RestaurantRole;

  if (!email || !email.includes("@")) {
    throw new Error("Valid email is required");
  }
  if (!["manager", "staff"].includes(role)) {
    throw new Error("Invalid role");
  }

  const existingPending = await prisma.restaurantInvite.findFirst({
    where: {
      restaurant_id: restaurant.id,
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
  const invite = await prisma.restaurantInvite.create({
    data: {
      restaurant_id: restaurant.id,
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
  const { restaurant, membership } = await requireRestaurantMembership();
  requireRole("owner", membership.role);

  await prisma.restaurantInvite.updateMany({
    where: {
      id: inviteId,
      restaurant_id: restaurant.id,
      status: "pending",
    },
    data: { status: "revoked" },
  });
}

export async function getInviteByToken(token: string) {
  const invite = await prisma.restaurantInvite.findFirst({
    where: { token },
    include: { restaurant: { select: { name: true } } },
  });

  if (!invite) return null;

  if (invite.status === "pending" && invite.expires_at < new Date()) {
    await prisma.restaurantInvite.update({
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

  const invite = await prisma.restaurantInvite.findFirst({
    where: { token, status: "pending" },
  });

  if (!invite) {
    redirect(`/auth/accept-invite?token=${encodedToken}&error=${encodeURIComponent("Invite is invalid or no longer active")}`);
  }

  if (invite.expires_at < new Date()) {
    await prisma.restaurantInvite.update({
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
    await tx.userRestaurant.upsert({
      where: {
        user_id_restaurant_id: {
          user_id: user.id,
          restaurant_id: invite.restaurant_id,
        },
      },
      create: {
        user_id: user.id,
        restaurant_id: invite.restaurant_id,
        role: invite.role,
      },
      update: {
        role: invite.role,
      },
    });

    await tx.restaurantInvite.update({
      where: { id: invite.id },
      data: {
        status: "accepted",
        accepted_at: new Date(),
      },
    });
  });

  redirect("/");
}
