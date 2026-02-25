import { NextResponse } from "next/server";
import { dbAll, dbGet } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await dbAll<{
    id: string;
    mode: string;
    status: string;
    challenger_json: string;
    defender_json: string;
    created_at: number;
  }>(
    `SELECT id, mode, status, challenger_json, defender_json, created_at
     FROM battles
     WHERE status IN ('active', 'judging', 'pending')
     ORDER BY created_at DESC
     LIMIT 50`
  );

  const battles = await Promise.all(
    rows.map(async (row) => {
      const challenger = JSON.parse(row.challenger_json) as { shardId: string };
      const defender = JSON.parse(row.defender_json) as { shardId: string };
      const challengerShard = await dbGet<{ name: string; species: string }>(
        "SELECT name, species FROM shards WHERE id = ?",
        challenger.shardId
      );
      const defenderShard = await dbGet<{ name: string; species: string }>(
        "SELECT name, species FROM shards WHERE id = ?",
        defender.shardId
      );

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
    })
  );

  return NextResponse.json(battles);
}
