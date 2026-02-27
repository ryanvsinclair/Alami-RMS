import { NextRequest, NextResponse } from "next/server";
import { requireBusinessMembership, requireRole } from "@/core/auth/tenant";
import { handleIncomeOAuthCallback, normalizeIncomeProviderId } from "@/features/integrations/server";

function sanitizeReturnToPath(value: string | null): string {
  if (!value) return "/integrations";
  if (!value.startsWith("/")) return "/integrations";
  return value;
}

function buildRedirectUrl(
  request: NextRequest,
  returnToPath: string,
  params: Record<string, string>
) {
  const url = new URL(returnToPath, request.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider } = await context.params;
  const providerId = normalizeIncomeProviderId(provider);
  const fallbackReturnToPath = sanitizeReturnToPath(request.nextUrl.searchParams.get("return_to"));

  if (!providerId) {
    return NextResponse.redirect(
      buildRedirectUrl(request, fallbackReturnToPath, { oauth_error: "Unsupported provider" })
    );
  }

  const errorMessage = request.nextUrl.searchParams.get("error_description") ??
    request.nextUrl.searchParams.get("error");
  if (errorMessage) {
    return NextResponse.redirect(
      buildRedirectUrl(request, fallbackReturnToPath, { oauth_error: errorMessage })
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(
      buildRedirectUrl(request, fallbackReturnToPath, {
        oauth_error: "Missing code or state in callback",
      })
    );
  }

  try {
    const { business, membership } = await requireBusinessMembership();
    requireRole("manager", membership.role);

    const callbackResult = await handleIncomeOAuthCallback({
      businessId: business.id,
      providerId,
      code,
      state,
    });

    const returnToPath = sanitizeReturnToPath(callbackResult.returnToPath ?? fallbackReturnToPath);
    return NextResponse.redirect(
      buildRedirectUrl(request, returnToPath, {
        oauth: "connected",
        provider: providerId,
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth callback failed";
    return NextResponse.redirect(
      buildRedirectUrl(request, fallbackReturnToPath, { oauth_error: message })
    );
  }
}
