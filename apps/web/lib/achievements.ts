import crypto from "crypto";
import { dbGet, dbAll, dbRun } from "@/lib/db";

const ACHIEVEMENTS = [
  { key: "first_capture", name: "First Capture", description: "Capture your first shard." },
  { key: "collector_5", name: "Collector I", description: "Own 5 shards." },
  { key: "first_battle", name: "First Blood", description: "Complete your first battle." },
  { key: "first_win", name: "Victor", description: "Win your first battle." },
  { key: "win_streak_3", name: "Hot Streak", description: "Win 3 battles in a row." },
] as const;

async function isUnlocked(ownerId: string, key: string): Promise<boolean> {
  const row = await dbGet(
    "SELECT id FROM achievements_unlocked WHERE owner_id = ? AND achievement_key = ?",
    ownerId,
    key
  );
  return !!row;
}

async function unlock(ownerId: string, key: string, meta?: Record<string, unknown>) {
  if (await isUnlocked(ownerId, key)) return;
  await dbRun(
    `INSERT INTO achievements_unlocked (id, owner_id, achievement_key, unlocked_at, meta_json)
     VALUES (?, ?, ?, ?, ?)`,
    crypto.randomUUID(),
    ownerId,
    key,
    Date.now(),
    meta ? JSON.stringify(meta) : null
  );
}

async function computeWinStreak(ownerId: string): Promise<number> {
  const pattern = `%"keeperId":"${ownerId.toLowerCase()}"%`;
  const rows = await dbAll<any>(
    `SELECT challenger_json, defender_json, winner_id
     FROM battles
     WHERE status = 'completed' AND (challenger_json LIKE ? OR defender_json LIKE ?)
     ORDER BY completed_at DESC
     LIMIT 20`,
    pattern,
    pattern
  );

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

export async function evaluateAchievements(ownerId: string) {
  const ownedCount = (
    await dbGet<{ count: number }>(
      "SELECT COUNT(*) as count FROM shards WHERE owner_id = ? AND is_wild = 0",
      ownerId
    )
  )?.count ?? 0;
  if (ownedCount >= 1) await unlock(ownerId, "first_capture");
  if (ownedCount >= 5) await unlock(ownerId, "collector_5");

  const pattern = `%"keeperId":"${ownerId.toLowerCase()}"%`;
  const completed = (
    await dbGet<{ count: number }>(
      `SELECT COUNT(*) as count FROM battles
       WHERE status = 'completed' AND (challenger_json LIKE ? OR defender_json LIKE ?)`,
      pattern,
      pattern
    )
  )?.count ?? 0;
  if (completed >= 1) await unlock(ownerId, "first_battle");

  const battles = await dbAll<any>(
    `SELECT challenger_json, defender_json, winner_id
     FROM battles
     WHERE status = 'completed' AND (challenger_json LIKE ? OR defender_json LIKE ?)`,
    pattern,
    pattern
  );
  const wins = battles.filter((row) => {
    const challenger = JSON.parse(row.challenger_json) as { keeperId: string; shardId: string };
    const defender = JSON.parse(row.defender_json) as { keeperId: string; shardId: string };
    const myShardId =
      challenger.keeperId.toLowerCase() === ownerId.toLowerCase()
        ? challenger.shardId
        : defender.shardId;
    return row.winner_id === myShardId;
  }).length;
  if (wins >= 1) await unlock(ownerId, "first_win");

  const streak = await computeWinStreak(ownerId);
  if (streak >= 3) await unlock(ownerId, "win_streak_3", { streak });
}

export async function listAchievements(ownerId: string) {
  const unlockedRows = await dbAll<{
    achievement_key: string;
    unlocked_at: number;
    meta_json: string | null;
  }>(
    `SELECT achievement_key, unlocked_at, meta_json
     FROM achievements_unlocked
     WHERE owner_id = ?`,
    ownerId
  );

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
