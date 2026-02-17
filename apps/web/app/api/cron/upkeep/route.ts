import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const UPKEEP_COST_PER_SHARD = 100; // $1.00 in cents
const SHELTER_DISCOUNT = 0.5; // 50% discount for shelter-listed shards
const ACTIVE_DISCOUNT = 1.0; // 100% discount for recently active shards (battled in last 7 days)
const UPKEEP_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * GET /api/cron/upkeep
 * Monthly identity upkeep check. Run via cron job.
 * Calculates upkeep costs per shard owner and flags shards that haven't paid.
 */
export async function GET() {
  const db = getDb();
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Get all owned (non-wild) shards grouped by owner
  const owners = db
    .prepare(
      `SELECT owner_id, COUNT(*) as shard_count
       FROM shards
       WHERE owner_id IS NOT NULL AND is_wild = 0
       GROUP BY owner_id`
    )
    .all() as { owner_id: string; shard_count: number }[];

  let processed = 0;
  let totalUpkeep = 0;

  for (const owner of owners) {
    // Count shards listed in shelter (is_wild = 0 means owned, shelter = listed for bonding)
    // For now we approximate: shards with recent interactions from non-owners get discount
    const activeShards = db
      .prepare(
        `SELECT COUNT(DISTINCT s.id) as count
         FROM shards s
         JOIN training_messages tm ON tm.shard_id = s.id
         WHERE s.owner_id = ? AND s.is_wild = 0 AND tm.timestamp > ?`
      )
      .get(owner.owner_id, sevenDaysAgo) as { count: number };

    const totalShards = owner.shard_count;
    const activeCount = activeShards.count;
    const inactiveCount = totalShards - activeCount;

    // Active shards get full discount, inactive pay full upkeep
    const upkeepCents =
      activeCount * UPKEEP_COST_PER_SHARD * (1 - ACTIVE_DISCOUNT) +
      inactiveCount * UPKEEP_COST_PER_SHARD; // full price, shelter discount not yet implemented

    totalUpkeep += upkeepCents;
    processed++;

    // TODO: Deduct upkeep from user's USDC balance or flag for Stripe charge
    // For now, just log the upkeep calculation
  }

  return NextResponse.json({
    processed,
    totalOwners: owners.length,
    totalUpkeepCents: totalUpkeep,
    timestamp: now,
  });
}
