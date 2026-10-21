import { NextResponse } from "next/server";
import { sendCalibrationDigest } from "@/lib/instruments";

export const dynamic = "force-dynamic";

/**
 * Weekly calibration digest (due / overdue / not calibrated) to QA users.
 * Meant to be called by a scheduler once a week (e.g. Monday 08:00 IST)
 * with `Authorization: Bearer $CRON_SECRET` — Vercel Cron, a GitHub
 * Actions schedule, or Windows Task Scheduler running curl. Not
 * session-authenticated, so it refuses to run without CRON_SECRET set.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await sendCalibrationDigest();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
