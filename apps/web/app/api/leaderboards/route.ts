import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbGet } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  const limit = Math.min(100, Math.max(10, Number(searchParams.get("limit") ?? "50")));

  const global = await dbAll(
    `SELECT id, name, species, level, elo_rating
     FROM shards
     WHERE is_wild = 0
     ORDER BY elo_rating DESC, level DESC
     LIMIT ?`,
    limit
  );

  const modeWins = mode
    ? await dbAll(
        `SELECT winner_id as shard_id, COUNT(*) as wins
         FROM battles
         WHERE status = 'completed' AND mode = ? AND winner_id IS NOT NULL
         GROUP BY winner_id
         ORDER BY wins DESC
         LIMIT ?`,
        mode, limit
      )
    : await dbAll(
        `SELECT winner_id as shard_id, COUNT(*) as wins
         FROM battles
         WHERE status = 'completed' AND winner_id IS NOT NULL
         GROUP BY winner_id
         ORDER BY wins DESC
         LIMIT ?`,
        limit
      );

  const weekly = await dbAll(
    `SELECT winner_id as shard_id, COUNT(*) as wins
     FROM battles
     WHERE status = 'completed' AND winner_id IS NOT NULL AND completed_at >= ?
     GROUP BY winner_id
     ORDER BY wins DESC
     LIMIT ?`,
    Date.now() - 7 * 24 * 60 * 60 * 1000, limit
  );

  const enrich = async (rows: any[]) =>
    Promise.all(
      rows.map(async (row) => {
        const shard = await dbGet<{ id: string; name: string; species: string; level: number; elo_rating: number }>(
          "SELECT id, name, species, level, elo_rating FROM shards WHERE id = ?",
          row.shard_id ?? row.id
        );
        return {
          shardId: shard?.id ?? row.shard_id,
          name: shard?.name ?? "Unknown",
          species: shard?.species ?? "Unknown",
          level: shard?.level ?? 1,
          elo: shard?.elo_rating ?? 1200,
          wins: row.wins ?? 0,
        };
      })
    );

  return NextResponse.json({
    global,
    modeWins: await enrich(modeWins as any[]),
    weeklyWinners: await enrich(weekly as any[]),
    mode: mode ?? null,
  });
}
