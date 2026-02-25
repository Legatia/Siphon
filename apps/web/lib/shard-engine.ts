import { getDb, shardToRow, rowToShard, dbGet, dbAll, dbRun } from "./db";
import { spawnShard, addXp, type Shard } from "@siphon/core";

export async function spawnWildShard(): Promise<Shard> {
  const shard = spawnShard();
  const row = shardToRow(shard);
  const c = await getDb();
  await c.execute({
    sql: `INSERT INTO shards (id, genome_hash, type, species, name, level, xp, owner_id, is_wild, avatar_json, specialization, personality, stats_json, created_at, last_interaction, decay_factor, last_decay_check, fused_from_json, cosmetic_slots_json, token_id, elo_rating)
    VALUES (:id, :genome_hash, :type, :species, :name, :level, :xp, :owner_id, :is_wild, :avatar_json, :specialization, :personality, :stats_json, :created_at, :last_interaction, :decay_factor, :last_decay_check, :fused_from_json, :cosmetic_slots_json, :token_id, :elo_rating)`,
    args: {
      id: row.id,
      genome_hash: row.genome_hash,
      type: row.type,
      species: row.species,
      name: row.name,
      level: row.level,
      xp: row.xp,
      owner_id: row.owner_id,
      is_wild: row.is_wild,
      avatar_json: row.avatar_json,
      specialization: row.specialization,
      personality: row.personality,
      stats_json: row.stats_json,
      created_at: row.created_at,
      last_interaction: row.last_interaction,
      decay_factor: row.decay_factor,
      last_decay_check: row.last_decay_check,
      fused_from_json: row.fused_from_json,
      cosmetic_slots_json: row.cosmetic_slots_json,
      token_id: row.token_id,
      elo_rating: row.elo_rating,
    },
  });

  return shard;
}

export async function getWildShards(): Promise<Shard[]> {
  const rows = await dbAll("SELECT * FROM shards WHERE is_wild = 1");
  return rows.map(rowToShard);
}

export async function getShardById(id: string): Promise<Shard | null> {
  const row = await dbGet("SELECT * FROM shards WHERE id = ?", id);
  return row ? rowToShard(row) : null;
}

export async function getOwnedShards(ownerId: string): Promise<Shard[]> {
  const rows = await dbAll(
    "SELECT * FROM shards WHERE owner_id = ? AND is_wild = 0",
    ownerId
  );
  return rows.map(rowToShard);
}

export async function getAllShards(): Promise<Shard[]> {
  const rows = await dbAll("SELECT * FROM shards WHERE is_wild = 0");
  return rows.map(rowToShard);
}

export async function captureShard(shardId: string, ownerId: string): Promise<Shard | null> {
  const result = await dbRun(
    "UPDATE shards SET is_wild = 0, owner_id = ?, last_interaction = ? WHERE id = ? AND is_wild = 1",
    ownerId,
    Date.now(),
    shardId
  );

  if (result.rowsAffected === 0) return null;
  return getShardById(shardId);
}

export async function releaseToWild(shardId: string, ownerId: string): Promise<boolean> {
  const result = await dbRun(
    "UPDATE shards SET is_wild = 1, owner_id = NULL WHERE id = ? AND owner_id = ?",
    shardId,
    ownerId
  );
  return (result.rowsAffected ?? 0) > 0;
}

export async function updateShardXp(shardId: string, xpAmount: number): Promise<Shard | null> {
  const shard = await getShardById(shardId);
  if (!shard) return null;

  const updated = addXp(shard, xpAmount);
  await dbRun(
    "UPDATE shards SET level = ?, xp = ?, last_interaction = ? WHERE id = ?",
    updated.level,
    updated.xp,
    updated.lastInteraction,
    shardId
  );

  return updated;
}

/**
 * Award a small stat boost to the shard based on its type.
 * Each training interaction has a chance to improve the shard's primary stat.
 */
export async function improveShardStats(shardId: string): Promise<Shard | null> {
  const shard = await getShardById(shardId);
  if (!shard) return null;

  // Type → primary stat mapping
  const typeStatMap: Record<number, keyof typeof shard.stats> = {
    0: "intelligence", // Oracle
    1: "precision",    // Cipher
    2: "intelligence", // Scribe
    3: "creativity",   // Muse
    4: "precision",    // Architect
    5: "charisma",     // Advocate
    6: "resilience",   // Sentinel
    7: "creativity",   // Mirror
  };

  const primaryStat = typeStatMap[shard.type] ?? "intelligence";

  // 40% chance to gain +1 primary stat, 20% chance to gain +1 random secondary stat
  const stats = { ...shard.stats };
  const statKeys = Object.keys(stats) as (keyof typeof stats)[];

  if (Math.random() < 0.4) {
    stats[primaryStat] = Math.min(stats[primaryStat] + 1, 115);
  }

  if (Math.random() < 0.2) {
    const secondaryKey = statKeys[Math.floor(Math.random() * statKeys.length)];
    stats[secondaryKey] = Math.min(stats[secondaryKey] + 1, 115);
  }

  // Only update if something changed
  if (JSON.stringify(stats) === JSON.stringify(shard.stats)) return shard;

  await dbRun(
    "UPDATE shards SET stats_json = ? WHERE id = ?",
    JSON.stringify(stats),
    shardId
  );

  return { ...shard, stats };
}

export async function ensureWildShards(minCount: number = 8): Promise<Shard[]> {
  const wild = await getWildShards();
  const toSpawn = Math.max(0, minCount - wild.length);
  const spawned: Shard[] = [];
  for (let i = 0; i < toSpawn; i++) {
    spawned.push(await spawnWildShard());
  }
  return [...wild, ...spawned];
}
