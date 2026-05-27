import { NextResponse } from "next/server";
import { scanAllWallets } from "@/lib/positionScanner";

/**
 * GET /api/cron/positions
 *
 * Refresh every tracked wallet's positions in our known vaults.
 * Suggested cadence: every 15-30 minutes.
 *
 * Auth: add Bearer CRON_SECRET check when deploying.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();
  try {
    const summary = await scanAllWallets();
    return NextResponse.json({
      ok: true,
      tookMs: Date.now() - startedAt,
      ...summary,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
