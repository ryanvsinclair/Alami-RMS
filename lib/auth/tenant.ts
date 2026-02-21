import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth/server";
import type { RestaurantRole } from "@/lib/generated/prisma/client";

export async function ensureRestaurantForUser(userId: string, preferredName?: string) {
  const existing = await prisma.userRestaurant.findFirst({
    where: { user_id: userId },
    include: { restaurant: true },
  });

  if (existing?.restaurant) {
    return existing.restaurant;
  }

  const restaurant = await prisma.restaurant.create({
    data: {
      name: preferredName?.trim() || "My Restaurant",
      memberships: {
        create: {
          user_id: userId,
          role: "owner",
        },
      },
    },
  });

  return restaurant;
}

export async function requireRestaurantId() {
  const user = await requireSupabaseUser();
  const restaurant = await ensureRestaurantForUser(user.id);
  return restaurant.id;
}

export async function requireRestaurantMembership() {
  const user = await requireSupabaseUser();
  const restaurant = await ensureRestaurantForUser(user.id);
  const membership = await prisma.userRestaurant.findFirst({
    where: {
      user_id: user.id,
      restaurant_id: restaurant.id,
    },
  });
  if (!membership) {
    throw new Error("No restaurant membership");
  }
  return { user, restaurant, membership };
}

export function requireRole(role: RestaurantRole, currentRole: RestaurantRole) {
  const order: Record<RestaurantRole, number> = {
    owner: 3,
    manager: 2,
    staff: 1,
  };

  if (order[currentRole] < order[role]) {
    throw new Error("Insufficient permissions");
  }
}
