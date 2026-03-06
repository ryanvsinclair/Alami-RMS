import { NextRequest, NextResponse } from "next/server";
import { verifyHmacSha256Signature, readRawBody } from "@/features/integrations/server/webhook-crypto";
import { prisma } from "@/core/prisma";

/**
 * Uber Eats webhook endpoint.
 *
 * Uber Eats sends a POST with:
 *   X-Uber-Signature: sha256=<hex>
 *   Content-Type: application/json
 *
 * Required env var:
 *   - INCOME_WEBHOOK_SECRET_UBER_EATS
 *   - or fallback to INCOME_OAUTH_UBER_EATS_CLIENT_SECRET
 *
 * On receipt, we mark last_webhook_at and enqueue the payload for
 * async processing (or process inline if event count is small).
 */
export async function POST(request: NextRequest) {
  const secret =
    process.env.INCOME_WEBHOOK_SECRET_UBER_EATS ??
    process.env.INCOME_OAUTH_UBER_EATS_CLIENT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await readRawBody(request);
  const signature = request.headers.get("x-uber-signature") ?? "";

  const valid = verifyHmacSha256Signature({
    secret,
    payload: rawBody,
    receivedSignature: signature,
    stripPrefix: "sha256=",
  });

  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf-8"));
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Extract business identifier from webhook metadata if present
  const eventPayload = payload as Record<string, unknown>;
  const externalAccountId =
    typeof eventPayload.restaurant_id === "string" ? eventPayload.restaurant_id :
    typeof eventPayload.store_id === "string" ? eventPayload.store_id : null;
  const externalLocationId =
    typeof eventPayload.store_id === "string" ? eventPayload.store_id :
    typeof eventPayload.location_id === "string" ? eventPayload.location_id : null;
  const connectionTargets: Array<
    { external_account_id: string } |
    { external_location_id: string }
  > = [];
  if (externalAccountId) {
    connectionTargets.push({ external_account_id: externalAccountId });
  }
  if (externalLocationId) {
    connectionTargets.push({ external_location_id: externalLocationId });
  }

  if (connectionTargets.length > 0) {
    // Update last_webhook_at for the matching connection
    await prisma.businessIncomeConnection.updateMany({
      where: {
        provider_id: "uber_eats",
        status: "connected",
        OR: connectionTargets,
      },
      data: { last_webhook_at: new Date() },
    }).catch(() => {
      // Non-fatal: connection may not be found yet
    });
  }

  // Acknowledge receipt — processing happens via next cron sync
  return NextResponse.json({ received: true });
}
