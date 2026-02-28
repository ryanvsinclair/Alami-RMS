import { prisma } from "@/core/prisma";
import { requireSupabaseUser } from "@/core/auth/server";
import { INDUSTRY_PRESETS } from "@/lib/config/presets";
import type { BusinessRole, IndustryType } from "@/lib/generated/prisma/client";

interface EnsureBusinessForUserOptions {
  industryType?: IndustryType;
  googlePlaceId?: string | null;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export async function ensureBusinessForUser(
  userId: string,
  preferredName?: string,
  options?: EnsureBusinessForUserOptions
) {
  const industryType = options?.industryType ?? "general";
  const preset = INDUSTRY_PRESETS[industryType] ?? INDUSTRY_PRESETS.general;
  const googlePlaceId = options?.googlePlaceId?.trim() || null;
  const formattedAddress = options?.formattedAddress?.trim() || null;
  const latitude = options?.latitude ?? null;
  const longitude = options?.longitude ?? null;

  const existing = await prisma.userBusiness.findFirst({
    where: { user_id: userId },
    include: { business: true },
  });

  if (existing?.business) {
    const updateData: {
      google_place_id?: string;
      formatted_address?: string;
      latitude?: number;
      longitude?: number;
    } = {};

    if (googlePlaceId) updateData.google_place_id = googlePlaceId;
    if (formattedAddress) updateData.formatted_address = formattedAddress;
    if (latitude != null) updateData.latitude = latitude;
    if (longitude != null) updateData.longitude = longitude;

    if (Object.keys(updateData).length > 0) {
      return prisma.business.update({
        where: { id: existing.business.id },
        data: updateData,
      });
    }

    return existing.business;
  }

  const business = await prisma.business.create({
    data: {
      name: preferredName?.trim() || "My Business",
      industry_type: industryType,
      google_place_id: googlePlaceId,
      formatted_address: formattedAddress,
      latitude,
      longitude,
      modules: {
        create: preset.defaultModules.map((moduleId) => ({
          module_id: moduleId,
          enabled: true,
        })),
      },
      categories: {
        create: preset.defaultCategories.map((name) => ({ name })),
      },
      memberships: {
        create: {
          user_id: userId,
          role: "owner",
        },
      },
    },
  });

  return business;
}

export async function requireBusinessId() {
  const user = await requireSupabaseUser();
  const business = await ensureBusinessForUser(user.id);
  return business.id;
}

export async function requireBusinessMembership() {
  const user = await requireSupabaseUser();
  const business = await ensureBusinessForUser(user.id);
  const membership = await prisma.userBusiness.findFirst({
    where: {
      user_id: user.id,
      business_id: business.id,
    },
  });
  if (!membership) {
    throw new Error("No business membership");
  }
  return { user, business, membership };
}

export function requireRole(role: BusinessRole, currentRole: BusinessRole) {
  const order: Record<BusinessRole, number> = {
    owner: 3,
    manager: 2,
    staff: 1,
  };

  if (order[currentRole] < order[role]) {
    throw new Error("Insufficient permissions");
  }
}
