import { NextRequest, NextResponse } from "next/server";
import { requireBusinessMembership, requireRole } from "@/core/auth/tenant";
import { normalizeIncomeProviderId, startIncomeOAuthFlow } from "@/features/integrations/server";

function sanitizeReturnToPath(value: string | null): string {
  if (!value) return "/integrations";
  if (!value.startsWith("/")) return "/integrations";
  return value;
}

function redirectWithError(request: NextRequest, returnToPath: string, message: string) {
  const url = new URL(returnToPath, request.url);
  url.searchParams.set("oauth_error", message);
  return NextResponse.redirect(url);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider } = await context.params;
  const providerId = normalizeIncomeProviderId(provider);
  const returnToPath = sanitizeReturnToPath(request.nextUrl.searchParams.get("return_to"));

  if (!providerId) {
    return redirectWithError(request, returnToPath, "Unsupported provider");
  }

  try {
    const { business, membership, user } = await requireBusinessMembership();
    requireRole("manager", membership.role);

    const redirectUri = new URL(
      `/api/integrations/oauth/${providerId}/callback`,
      request.url
    ).toString();

    const { authorizationUrl } = await startIncomeOAuthFlow({
      businessId: business.id,
      userId: user.id,
      providerId,
      redirectUri,
      returnToPath,
    });

    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth start failed";
    return redirectWithError(request, returnToPath, message);
  }
}
