import { NextRequest, NextResponse } from "next/server";
import { verifyHmacSha256Signature, readRawBody } from "@/features/integrations/server/webhook-crypto";
import { prisma } from "@/core/prisma";

/**
 * DoorDash webhook endpoint.
 *
 * DoorDash sends a POST with:
 *   X-DoorDash-Signature: <hex>
 *   Content-Type: application/json
 *
 * Required env var: INCOME_WEBHOOK_SECRET_DOORDASH
 *
 * On receipt, we mark last_webhook_at and acknowledge. Incremental
 * sync picks up the new data on the next cron run.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.INCOME_WEBHOOK_SECRET_DOORDASH;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await readRawBody(request);
  const signature = request.headers.get("x-doordash-signature") ?? "";

  const valid = verifyHmacSha256Signature({
    secret,
    payload: rawBody,
    receivedSignature: signature,
    // DoorDash sends raw hex without a prefix
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
  const externalStoreId =
    typeof eventPayload.store_id === "string" ? eventPayload.store_id :
    typeof eventPayload.external_store_id === "string" ? eventPayload.external_store_id : null;

  if (externalStoreId) {
    await prisma.businessIncomeConnection.updateMany({
      where: {
        provider_id: "doordash",
        external_location_id: externalStoreId,
        status: "connected",
      },
      data: { last_webhook_at: new Date() },
    }).catch(() => {
      // Non-fatal
    });
  }

  return NextResponse.json({ received: true });
}
