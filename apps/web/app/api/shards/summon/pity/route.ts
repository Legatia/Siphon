import { NextResponse } from "next/server";
import { requireSessionAddress } from "@/lib/session-auth";
import { dbGet } from "@/lib/db";
import { PITY_RARE_THRESHOLD, PITY_EPIC_THRESHOLD } from "@siphon/core";

export async function GET() {
  const auth = await requireSessionAddress();
  if ("error" in auth) return auth.error;

  const row = await dbGet<{
    total_pulls: number;
    pulls_since_rare: number;
    pulls_since_epic: number;
    updated_at: number;
  }>("SELECT * FROM summon_pity WHERE user_id = ?", auth.address);

  const pullsSinceRare = row?.pulls_since_rare ?? 0;
  const pullsSinceEpic = row?.pulls_since_epic ?? 0;

  // Check free daily usage
  const today = new Date().toISOString().slice(0, 10);
  const daily = await dbGet<{ free_pulls: number }>(
    "SELECT free_pulls FROM summon_daily WHERE user_id = ? AND date = ?",
    auth.address,
    today
  );

  return NextResponse.json({
    totalPulls: row?.total_pulls ?? 0,
    pullsSinceRare,
    pullsSinceEpic,
    pullsUntilRareGuarantee: Math.max(0, PITY_RARE_THRESHOLD - pullsSinceRare),
    pullsUntilEpicGuarantee: Math.max(0, PITY_EPIC_THRESHOLD - pullsSinceEpic),
    freePullUsedToday: (daily?.free_pulls ?? 0) >= 1,
  });
}
