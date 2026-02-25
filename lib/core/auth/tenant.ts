import { prisma } from "@/core/prisma";
import { requireSupabaseUser } from "@/core/auth/server";
import { INDUSTRY_PRESETS } from "@/lib/config/presets";
import type { BusinessRole, IndustryType } from "@/lib/generated/prisma/client";

export async function ensureBusinessForUser(
  userId: string,
  preferredName?: string,
  options?: { industryType?: IndustryType }
) {
  const existing = await prisma.userBusiness.findFirst({
    where: { user_id: userId },
    include: { business: true },
  });

  if (existing?.business) {
    return existing.business;
  }

  const industryType = options?.industryType ?? "general";
  const preset = INDUSTRY_PRESETS[industryType] ?? INDUSTRY_PRESETS.general;

  const business = await prisma.business.create({
    data: {
      name: preferredName?.trim() || "My Business",
      industry_type: industryType,
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
