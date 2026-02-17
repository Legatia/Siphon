import { getDb, shardToRow, rowToShard } from "./db";
import { spawnShard, addXp, type Shard } from "@siphon/core";

export function spawnWildShard(): Shard {
  const db = getDb();
  const shard = spawnShard();
  const row = shardToRow(shard);

  db.prepare(`
    INSERT INTO shards (id, genome_hash, type, species, name, level, xp, owner_id, is_wild, avatar_json, specialization, personality, stats_json, created_at, last_interaction, decay_factor, last_decay_check, fused_from_json, cosmetic_slots_json, token_id, elo_rating)
    VALUES (@id, @genome_hash, @type, @species, @name, @level, @xp, @owner_id, @is_wild, @avatar_json, @specialization, @personality, @stats_json, @created_at, @last_interaction, @decay_factor, @last_decay_check, @fused_from_json, @cosmetic_slots_json, @token_id, @elo_rating)
  `).run(row);

  return shard;
}

export function getWildShards(): Shard[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM shards WHERE is_wild = 1").all();
  return rows.map(rowToShard);
}

export function getShardById(id: string): Shard | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM shards WHERE id = ?").get(id);
  return row ? rowToShard(row) : null;
}

export function getOwnedShards(ownerId: string): Shard[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM shards WHERE owner_id = ? AND is_wild = 0")
    .all(ownerId);
  return rows.map(rowToShard);
}

export function getAllShards(): Shard[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM shards WHERE is_wild = 0").all();
  return rows.map(rowToShard);
}

export function captureShard(shardId: string, ownerId: string): Shard | null {
  const db = getDb();
  const result = db
    .prepare(
      "UPDATE shards SET is_wild = 0, owner_id = ?, last_interaction = ? WHERE id = ? AND is_wild = 1"
    )
    .run(ownerId, Date.now(), shardId);

  if (result.changes === 0) return null;
  return getShardById(shardId);
}

export function releaseToWild(shardId: string, ownerId: string): boolean {
  const db = getDb();
  const result = db
    .prepare(
      "UPDATE shards SET is_wild = 1, owner_id = NULL WHERE id = ? AND owner_id = ?"
    )
    .run(shardId, ownerId);
  return result.changes > 0;
}

export function updateShardXp(shardId: string, xpAmount: number): Shard | null {
  const shard = getShardById(shardId);
  if (!shard) return null;

  const updated = addXp(shard, xpAmount);
  const db = getDb();
  db.prepare(
    "UPDATE shards SET level = ?, xp = ?, last_interaction = ? WHERE id = ?"
  ).run(updated.level, updated.xp, updated.lastInteraction, shardId);

  return updated;
}

export function ensureWildShards(minCount: number = 8): Shard[] {
  const wild = getWildShards();
  const toSpawn = Math.max(0, minCount - wild.length);
  const spawned: Shard[] = [];
  for (let i = 0; i < toSpawn; i++) {
    spawned.push(spawnWildShard());
  }
  return [...wild, ...spawned];
}
