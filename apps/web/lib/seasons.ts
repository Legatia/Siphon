import crypto from "crypto";
import { getDb } from "@/lib/db";

type Season = {
  id: string;
  name: string;
  starts_at: number;
  ends_at: number;
  status: string;
  created_at: number;
};

function seasonWindow(now: Date) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const startsAt = Date.UTC(year, month, 1, 0, 0, 0, 0);
  const endsAt = Date.UTC(year, month + 1, 1, 0, 0, 0, 0) - 1;
  const seasonId = `${year}-${String(month + 1).padStart(2, "0")}`;
  return { seasonId, startsAt, endsAt };
}

export function getActiveSeason(): Season {
  const db = getDb();
  const { seasonId, startsAt, endsAt } = seasonWindow(new Date());
  const existing = db
    .prepare("SELECT * FROM ranked_seasons WHERE id = ?")
    .get(seasonId) as Season | undefined;
  if (existing) return existing;

  const season: Season = {
    id: seasonId,
    name: `Season ${seasonId}`,
    starts_at: startsAt,
    ends_at: endsAt,
    status: "active",
    created_at: Date.now(),
  };
  db.prepare(
    `INSERT INTO ranked_seasons (id, name, starts_at, ends_at, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(season.id, season.name, season.starts_at, season.ends_at, season.status, season.created_at);
  return season;
}

export function recordSeasonResult(params: {
  ownerId: string;
  points: number;
  win: boolean;
  loss: boolean;
  draw: boolean;
  eloDelta: number;
}) {
  const db = getDb();
  const season = getActiveSeason();
  const now = Date.now();
  const stat = db
    .prepare("SELECT * FROM season_stats WHERE season_id = ? AND owner_id = ?")
    .get(season.id, params.ownerId) as
    | {
        id: string;
        wins: number;
        losses: number;
        draws: number;
        points: number;
        elo_delta: number;
      }
    | undefined;

  if (!stat) {
    db.prepare(
      `INSERT INTO season_stats
       (id, season_id, owner_id, wins, losses, draws, points, elo_delta, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      season.id,
      params.ownerId,
      params.win ? 1 : 0,
      params.loss ? 1 : 0,
      params.draw ? 1 : 0,
      params.points,
      params.eloDelta,
      now
    );
    return;
  }

  db.prepare(
    `UPDATE season_stats
     SET wins = ?, losses = ?, draws = ?, points = ?, elo_delta = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    stat.wins + (params.win ? 1 : 0),
    stat.losses + (params.loss ? 1 : 0),
    stat.draws + (params.draw ? 1 : 0),
    stat.points + params.points,
    stat.elo_delta + params.eloDelta,
    now,
    stat.id
  );
}

