import { prisma } from "@/core/prisma";
import { requireBusinessId } from "@/core/auth/tenant";

export async function requireModule(moduleId: string): Promise<void> {
  const businessId = await requireBusinessId();
  const mod = await prisma.businessModule.findUnique({
    where: {
      business_id_module_id: {
        business_id: businessId,
        module_id: moduleId,
      },
    },
    select: { enabled: true },
  });

  if (!mod?.enabled) {
    throw new Error(`Module "${moduleId}" is not enabled for this business`);
  }
}

export async function getEnabledModules(): Promise<string[]> {
  const businessId = await requireBusinessId();
  const modules = await prisma.businessModule.findMany({
    where: { business_id: businessId, enabled: true },
    select: { module_id: true },
  });
  return modules.map((m) => m.module_id);
}

export async function isModuleEnabled(moduleId: string): Promise<boolean> {
  const businessId = await requireBusinessId();
  const mod = await prisma.businessModule.findUnique({
    where: {
      business_id_module_id: {
        business_id: businessId,
        module_id: moduleId,
      },
    },
    select: { enabled: true },
  });
  return mod?.enabled ?? false;
}
