import { NextResponse } from "next/server";
import { getDb, rowToShard } from "@/lib/db";
import { calculateDecay } from "@siphon/core";

export const dynamic = "force-dynamic";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const db = getDb();
    const now = Date.now();
    const cutoff = now - ONE_DAY_MS;

    // Query non-wild shards whose decay hasn't been checked in over a day
    const rows = db
      .prepare(
        "SELECT * FROM shards WHERE is_wild = 0 AND last_decay_check < ?"
      )
      .all(cutoff);

    if (rows.length === 0) {
      return NextResponse.json({ updated: 0, message: "No shards need decay update" });
    }

    const updateStmt = db.prepare(
      "UPDATE shards SET decay_factor = ?, last_decay_check = ? WHERE id = ?"
    );

    const updateMany = db.transaction((shardRows: any[]) => {
      let count = 0;
      for (const row of shardRows) {
        const shard = rowToShard(row);
        const newDecayFactor = calculateDecay(
          shard.lastInteraction,
          shard.decayFactor,
          now
        );

        // Only update if the decay factor actually changed
        if (newDecayFactor !== shard.decayFactor) {
          updateStmt.run(newDecayFactor, now, shard.id);
          count++;
        } else {
          // Still update the check timestamp so we don't re-query this shard
          updateStmt.run(shard.decayFactor, now, shard.id);
        }
      }
      return count;
    });

    const updatedCount = updateMany(rows);

    return NextResponse.json({
      updated: updatedCount,
      checked: rows.length,
      message: `Decay applied to ${updatedCount} shard(s) out of ${rows.length} checked`,
    });
  } catch (error) {
    console.error("Decay cron error:", error);
    return NextResponse.json(
      { error: "Failed to process decay" },
      { status: 500 }
    );
  }
}
