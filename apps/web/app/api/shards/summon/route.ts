import { NextRequest, NextResponse } from "next/server";
import { requireSessionAddress, ensureAddressMatch } from "@/lib/session-auth";
import { canOwnMoreShards, getOwnedShardCount, getUserSubscription } from "@/lib/subscription-check";
import { getDb, shardToRow, dbGet, dbRun } from "@/lib/db";
import {
  SummonTier,
  ShardRarity,
  determineSummonRarity,
  spawnSummonedShard,
  calculateMultiPullCost,
  SUMMON_COSTS,
  type PityState,
  type SummonResult,
} from "@siphon/core";
import { getShardLimit } from "@/lib/stripe";

const VALID_COUNTS = [1, 5, 10];

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getPityState(userId: string): Promise<PityState> {
  const row = await dbGet<{
    total_pulls: number;
    pulls_since_rare: number;
    pulls_since_epic: number;
  }>("SELECT * FROM summon_pity WHERE user_id = ?", userId);

  return {
    totalPulls: row?.total_pulls ?? 0,
    pullsSinceRare: row?.pulls_since_rare ?? 0,
    pullsSinceEpic: row?.pulls_since_epic ?? 0,
  };
}

async function updatePityState(
  userId: string,
  rarity: ShardRarity,
  pity: PityState
): Promise<PityState> {
  const rarityIdx = [
    ShardRarity.Common,
    ShardRarity.Rare,
    ShardRarity.Epic,
    ShardRarity.Legendary,
    ShardRarity.Mythic,
  ].indexOf(rarity);

  const newPity: PityState = {
    totalPulls: pity.totalPulls + 1,
    pullsSinceRare: rarityIdx >= 1 ? 0 : pity.pullsSinceRare + 1,
    pullsSinceEpic: rarityIdx >= 2 ? 0 : pity.pullsSinceEpic + 1,
  };

  await dbRun(
    `INSERT INTO summon_pity (user_id, total_pulls, pulls_since_rare, pulls_since_epic, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       total_pulls = excluded.total_pulls,
       pulls_since_rare = excluded.pulls_since_rare,
       pulls_since_epic = excluded.pulls_since_epic,
       updated_at = excluded.updated_at`,
    userId,
    newPity.totalPulls,
    newPity.pullsSinceRare,
    newPity.pullsSinceEpic,
    Date.now()
  );

  return newPity;
}

export async function POST(request: NextRequest) {
  const auth = await requireSessionAddress();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const { tier, count = 1, txHash, ownerId } = body;

  // Validate tier
  if (tier === undefined || tier < 0 || tier > 3) {
    return NextResponse.json({ error: "Invalid tier (0-3)" }, { status: 400 });
  }

  // Validate count
  if (!VALID_COUNTS.includes(count)) {
    return NextResponse.json({ error: "Invalid count (1, 5, or 10)" }, { status: 400 });
  }

  const userId = ownerId ?? auth.address;
  const mismatch = ensureAddressMatch(auth.address, userId, "ownerId");
  if (mismatch) return mismatch;

  // Free tier: check daily limit
  if (tier === SummonTier.Common) {
    if (count !== 1) {
      return NextResponse.json({ error: "Free summons are 1 per day" }, { status: 400 });
    }
    const today = todayDateStr();
    const daily = await dbGet<{ free_pulls: number }>(
      "SELECT free_pulls FROM summon_daily WHERE user_id = ? AND date = ?",
      userId,
      today
    );

    if (daily && daily.free_pulls >= 1) {
      return NextResponse.json(
        { error: "Daily free summon already used. Come back tomorrow!" },
        { status: 429 }
      );
    }
  }

  // Paid tier: require txHash
  if (tier !== SummonTier.Common && !txHash) {
    return NextResponse.json(
      { error: "Transaction hash required for paid summons" },
      { status: 400 }
    );
  }

  // Check ownership limits
  const sub = await getUserSubscription(userId);
  const shardLimit = getShardLimit(sub.tier);
  if (shardLimit !== -1) {
    const owned = await getOwnedShardCount(userId);
    if (owned + count > shardLimit) {
      return NextResponse.json(
        {
          error: `Would exceed shard limit (${owned}/${shardLimit}). Reduce count or upgrade tier.`,
        },
        { status: 403 }
      );
    }
  }

  // Perform summons
  const batchId = crypto.randomUUID();
  const results: SummonResult[] = [];
  let pity = await getPityState(userId);
  const db = await getDb();

  const costPerPull = tier === SummonTier.Common ? 0 : calculateMultiPullCost(tier, count) / count;

  for (let i = 0; i < count; i++) {
    const seed = Math.random();
    const { rarity, isGuaranteed } = determineSummonRarity(tier, pity, seed);
    const shard = spawnSummonedShard(tier, rarity);
    shard.ownerId = userId;

    // Insert shard into DB
    const row = shardToRow(shard);
    await db.execute({
      sql: `INSERT INTO shards (id, genome_hash, type, species, name, level, xp, owner_id, is_wild, avatar_json, specialization, personality, stats_json, created_at, last_interaction, decay_factor, last_decay_check, fused_from_json, cosmetic_slots_json, token_id, elo_rating, rarity)
      VALUES (:id, :genome_hash, :type, :species, :name, :level, :xp, :owner_id, :is_wild, :avatar_json, :specialization, :personality, :stats_json, :created_at, :last_interaction, :decay_factor, :last_decay_check, :fused_from_json, :cosmetic_slots_json, :token_id, :elo_rating, :rarity)`,
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
        rarity: row.rarity,
      },
    });

    // Record the pull
    await dbRun(
      `INSERT INTO summon_pulls (id, user_id, tier, rarity, shard_id, cost_eth, tx_hash, batch_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      crypto.randomUUID(),
      userId,
      tier,
      rarity,
      shard.id,
      costPerPull,
      txHash ?? null,
      batchId,
      Date.now()
    );

    // Update pity
    pity = await updatePityState(userId, rarity, pity);

    results.push({ shard, rarity, tier, isGuaranteed });
  }

  // Track free daily
  if (tier === SummonTier.Common) {
    const today = todayDateStr();
    await dbRun(
      `INSERT INTO summon_daily (user_id, date, free_pulls)
       VALUES (?, ?, 1)
       ON CONFLICT(user_id, date) DO UPDATE SET free_pulls = free_pulls + 1`,
      userId,
      today
    );
  }

  return NextResponse.json({
    results,
    batchId,
    pity: {
      pullsSinceRare: pity.pullsSinceRare,
      pullsSinceEpic: pity.pullsSinceEpic,
      totalPulls: pity.totalPulls,
    },
  });
}
