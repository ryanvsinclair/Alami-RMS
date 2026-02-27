import { NextRequest, NextResponse } from "next/server";
import { requireBusinessMembership, requireRole } from "@/core/auth/tenant";
import { runUberEatsManualSync } from "@/features/integrations/server";

function sanitizeReturnToPath(value: string | null): string {
  if (!value) return "/integrations";
  if (!value.startsWith("/")) return "/integrations";
  return value;
}

function buildRedirect(request: NextRequest, returnToPath: string, params: Record<string, string>) {
  const url = new URL(returnToPath, request.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const returnToPath = sanitizeReturnToPath(request.nextUrl.searchParams.get("return_to"));

  try {
    const { business, membership } = await requireBusinessMembership();
    requireRole("manager", membership.role);

    const result = await runUberEatsManualSync({
      businessId: business.id,
      trigger: "manual",
    });

    return buildRedirect(request, returnToPath, {
      sync: "success",
      provider: "uber_eats",
      records: String(result.recordsFetched),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manual sync failed";
    return buildRedirect(request, returnToPath, {
      sync: "error",
      provider: "uber_eats",
      sync_error: message,
    });
  }
}
