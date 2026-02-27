import { NextRequest, NextResponse } from "next/server";
import { runAllProvidersCronSync } from "@/features/integrations/server";

/**
 * Internal cron sync route.
 *
 * Strategy: INCOME_SYNC_SCHEDULER_STRATEGY = "internal_cron_route"
 *
 * Secured by INCOME_CRON_SECRET — set this env var and configure your
 * external scheduler (Vercel Cron, Railway, Render, etc.) to call:
 *   GET /api/integrations/sync/cron
 *   Authorization: Bearer <INCOME_CRON_SECRET>
 *
 * This route is intentionally separate from authenticated user routes —
 * it runs as a server-side service call, not tied to a user session.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.INCOME_CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "Cron sync not configured (INCOME_CRON_SECRET not set)" },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim() ?? "";

  if (token !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAllProvidersCronSync();
    return NextResponse.json({
      ok: true,
      attempted: result.attempted,
      succeeded: result.succeeded,
      skipped: result.skipped,
      failed: result.failed,
      details: result.details,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
