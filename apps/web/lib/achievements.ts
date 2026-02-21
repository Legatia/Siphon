import crypto from "crypto";
import { getDb } from "@/lib/db";

const ACHIEVEMENTS = [
  { key: "first_capture", name: "First Capture", description: "Capture your first shard." },
  { key: "collector_5", name: "Collector I", description: "Own 5 shards." },
  { key: "first_battle", name: "First Blood", description: "Complete your first battle." },
  { key: "first_win", name: "Victor", description: "Win your first battle." },
  { key: "win_streak_3", name: "Hot Streak", description: "Win 3 battles in a row." },
] as const;

function isUnlocked(ownerId: string, key: string): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT id FROM achievements_unlocked WHERE owner_id = ? AND achievement_key = ?")
    .get(ownerId, key);
  return !!row;
}

function unlock(ownerId: string, key: string, meta?: Record<string, unknown>) {
  if (isUnlocked(ownerId, key)) return;
  const db = getDb();
  db.prepare(
    `INSERT INTO achievements_unlocked (id, owner_id, achievement_key, unlocked_at, meta_json)
     VALUES (?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), ownerId, key, Date.now(), meta ? JSON.stringify(meta) : null);
}

function computeWinStreak(ownerId: string): number {
  const db = getDb();
  const pattern = `%"keeperId":"${ownerId.toLowerCase()}"%`;
  const rows = db
    .prepare(
      `SELECT challenger_json, defender_json, winner_id
       FROM battles
       WHERE status = 'completed' AND (challenger_json LIKE ? OR defender_json LIKE ?)
       ORDER BY completed_at DESC
       LIMIT 20`
    )
    .all(pattern, pattern) as any[];

  let streak = 0;
  for (const row of rows) {
    const challenger = JSON.parse(row.challenger_json) as { keeperId: string; shardId: string };
    const defender = JSON.parse(row.defender_json) as { keeperId: string; shardId: string };
    const myShardId =
      challenger.keeperId.toLowerCase() === ownerId.toLowerCase()
        ? challenger.shardId
        : defender.shardId;
    if (row.winner_id === myShardId) {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

export function evaluateAchievements(ownerId: string) {
  const db = getDb();
  const ownedCount = (
    db
      .prepare("SELECT COUNT(*) as count FROM shards WHERE owner_id = ? AND is_wild = 0")
      .get(ownerId) as { count: number }
  ).count;
  if (ownedCount >= 1) unlock(ownerId, "first_capture");
  if (ownedCount >= 5) unlock(ownerId, "collector_5");

  const pattern = `%"keeperId":"${ownerId.toLowerCase()}"%`;
  const completed = (
    db
      .prepare(
        `SELECT COUNT(*) as count FROM battles
         WHERE status = 'completed' AND (challenger_json LIKE ? OR defender_json LIKE ?)`
      )
      .get(pattern, pattern) as { count: number }
  ).count;
  if (completed >= 1) unlock(ownerId, "first_battle");

  const battles = db
    .prepare(
      `SELECT challenger_json, defender_json, winner_id
       FROM battles
       WHERE status = 'completed' AND (challenger_json LIKE ? OR defender_json LIKE ?)`
    )
    .all(pattern, pattern) as any[];
  const wins = battles.filter((row) => {
    const challenger = JSON.parse(row.challenger_json) as { keeperId: string; shardId: string };
    const defender = JSON.parse(row.defender_json) as { keeperId: string; shardId: string };
    const myShardId =
      challenger.keeperId.toLowerCase() === ownerId.toLowerCase()
        ? challenger.shardId
        : defender.shardId;
    return row.winner_id === myShardId;
  }).length;
  if (wins >= 1) unlock(ownerId, "first_win");

  const streak = computeWinStreak(ownerId);
  if (streak >= 3) unlock(ownerId, "win_streak_3", { streak });
}

export function listAchievements(ownerId: string) {
  const db = getDb();
  const unlockedRows = db
    .prepare(
      `SELECT achievement_key, unlocked_at, meta_json
       FROM achievements_unlocked
       WHERE owner_id = ?`
    )
    .all(ownerId) as { achievement_key: string; unlocked_at: number; meta_json: string | null }[];

  const unlockedMap = new Map(unlockedRows.map((row) => [row.achievement_key, row]));
  return ACHIEVEMENTS.map((a) => {
    const unlocked = unlockedMap.get(a.key);
    return {
      ...a,
      unlocked: !!unlocked,
      unlockedAt: unlocked?.unlocked_at ?? null,
      meta: unlocked?.meta_json ? JSON.parse(unlocked.meta_json) : null,
    };
  });
}
