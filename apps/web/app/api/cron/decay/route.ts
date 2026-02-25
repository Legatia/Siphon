import { NextResponse } from "next/server";
import { dbAll, dbRun, getDb, rowToShard } from "@/lib/db";
import { calculateDecay } from "@siphon/core";

export const dynamic = "force-dynamic";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const now = Date.now();
    const cutoff = now - ONE_DAY_MS;

    // Query non-wild shards whose decay hasn't been checked in over a day
    const rows = await dbAll<any>(
      "SELECT * FROM shards WHERE is_wild = 0 AND last_decay_check < ?",
      cutoff
    );

    if (rows.length === 0) {
      return NextResponse.json({ updated: 0, message: "No shards need decay update" });
    }

    // Build batch statements for atomicity
    const stmts: Array<{ sql: string; args: any[] }> = [];
    let count = 0;

    for (const row of rows) {
      const shard = rowToShard(row);
      const newDecayFactor = calculateDecay(
        shard.lastInteraction,
        shard.decayFactor,
        now
      );

      if (newDecayFactor !== shard.decayFactor) {
        stmts.push({
          sql: "UPDATE shards SET decay_factor = ?, last_decay_check = ? WHERE id = ?",
          args: [newDecayFactor, now, shard.id],
        });
        count++;
      } else {
        stmts.push({
          sql: "UPDATE shards SET decay_factor = ?, last_decay_check = ? WHERE id = ?",
          args: [shard.decayFactor, now, shard.id],
        });
      }
    }

    const client = await getDb();
    await client.batch(stmts, "write");

    return NextResponse.json({
      updated: count,
      checked: rows.length,
      message: `Decay applied to ${count} shard(s) out of ${rows.length} checked`,
    });
  } catch (error) {
    console.error("Decay cron error:", error);
    return NextResponse.json(
      { error: "Failed to process decay" },
      { status: 500 }
    );
  }
}
