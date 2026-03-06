import { NextRequest, NextResponse } from "next/server";
import { requireBusinessMembership, requireRole } from "@/core/auth/tenant";
import { deprovisionUberEatsMerchantStore } from "@/features/integrations/server";

function sanitizeReturnToPath(value: string | null): string {
  if (!value) return "/integrations/uber-eats";
  if (!value.startsWith("/")) return "/integrations/uber-eats";
  return value;
}

function buildRedirect(request: NextRequest, returnToPath: string, params: Record<string, string>) {
  const url = new URL(returnToPath, request.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const returnToPath = sanitizeReturnToPath(request.nextUrl.searchParams.get("return_to"));
  const storeId = request.nextUrl.searchParams.get("store_id")?.trim() ?? "";

  if (!storeId) {
    return buildRedirect(request, returnToPath, {
      error: "Missing store_id for Uber Eats deprovisioning",
    });
  }

  try {
    const { business, membership } = await requireBusinessMembership();
    requireRole("manager", membership.role);

    await deprovisionUberEatsMerchantStore({
      businessId: business.id,
      storeId,
    });

    return buildRedirect(request, returnToPath, {
      deprovision: "success",
      store_id: storeId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Uber Eats deprovisioning failed";
    return buildRedirect(request, returnToPath, {
      error: message,
      store_id: storeId,
    });
  }
}
