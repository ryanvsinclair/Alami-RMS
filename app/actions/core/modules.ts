"use server";

import { prisma } from "@/core/prisma";
import { requireBusinessMembership, requireRole } from "@/core/auth/tenant";
import { serialize } from "@/core/utils/serialize";
import { getEnabledModules } from "@/core/modules/guard";
import { MODULE_REGISTRY } from "@/lib/modules/registry";

function assertKnownModule(moduleId: string) {
  if (!(moduleId in MODULE_REGISTRY)) {
    throw new Error(`Unknown module "${moduleId}"`);
  }
}

export async function enableModule(moduleId: string) {
  assertKnownModule(moduleId);
  const { business, membership } = await requireBusinessMembership();
  requireRole("owner", membership.role);

  const mod = await prisma.businessModule.upsert({
    where: {
      business_id_module_id: {
        business_id: business.id,
        module_id: moduleId,
      },
    },
    create: {
      business_id: business.id,
      module_id: moduleId,
      enabled: true,
    },
    update: { enabled: true },
  });

  return serialize(mod);
}

export async function disableModule(moduleId: string) {
  assertKnownModule(moduleId);
  const { business, membership } = await requireBusinessMembership();
  requireRole("owner", membership.role);

  const mod = await prisma.businessModule.upsert({
    where: {
      business_id_module_id: {
        business_id: business.id,
        module_id: moduleId,
      },
    },
    create: {
      business_id: business.id,
      module_id: moduleId,
      enabled: false,
    },
    update: { enabled: false },
  });

  return serialize(mod);
}

export async function getBusinessModules() {
  const { business } = await requireBusinessMembership();
  const modules = await prisma.businessModule.findMany({
    where: { business_id: business.id },
    orderBy: { module_id: "asc" },
  });
  return serialize(modules);
}

export async function getEnabledModulesAction() {
  return getEnabledModules();
}

export async function getCurrentBusinessConfigAction() {
  const [{ business }, enabledModules] = await Promise.all([
    requireBusinessMembership(),
    getEnabledModules(),
  ]);

  return {
    industryType: business.industry_type,
    enabledModules,
  };
}
