import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getActiveSeason } from "@/lib/seasons";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(10, Number(searchParams.get("limit") ?? "50")));
  const season = getActiveSeason();
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT owner_id, wins, losses, draws, points, elo_delta
       FROM season_stats
       WHERE season_id = ?
       ORDER BY points DESC, wins DESC, elo_delta DESC
       LIMIT ?`
    )
    .all(season.id, limit) as {
      owner_id: string;
      wins: number;
      losses: number;
      draws: number;
      points: number;
      elo_delta: number;
    }[];

  return NextResponse.json({
    season,
    leaderboard: rows.map((row, idx) => ({
      rank: idx + 1,
      ownerId: row.owner_id,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      points: row.points,
      eloDelta: row.elo_delta,
    })),
  });
}

