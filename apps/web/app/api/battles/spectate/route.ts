import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, mode, status, challenger_json, defender_json, created_at
       FROM battles
       WHERE status IN ('active', 'judging', 'pending')
       ORDER BY created_at DESC
       LIMIT 50`
    )
    .all() as any[];

  const battles = rows.map((row) => {
    const challenger = JSON.parse(row.challenger_json) as { shardId: string };
    const defender = JSON.parse(row.defender_json) as { shardId: string };
    const challengerShard = db
      .prepare("SELECT name, species FROM shards WHERE id = ?")
      .get(challenger.shardId) as { name: string; species: string } | undefined;
    const defenderShard = db
      .prepare("SELECT name, species FROM shards WHERE id = ?")
      .get(defender.shardId) as { name: string; species: string } | undefined;

    return {
      id: row.id,
      mode: row.mode,
      status: row.status,
      createdAt: row.created_at,
      challenger: {
        shardId: challenger.shardId,
        name: challengerShard?.name ?? challenger.shardId.slice(0, 8),
        species: challengerShard?.species ?? "Unknown",
      },
      defender: {
        shardId: defender.shardId,
        name: defenderShard?.name ?? defender.shardId.slice(0, 8),
        species: defenderShard?.species ?? "Unknown",
      },
    };
  });

  return NextResponse.json(battles);
}

