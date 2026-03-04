import { type Shard, type ShardStats, ShardRarity, SummonTier } from "./types";
import {
  SUMMON_DROP_RATES,
  SUMMON_COSTS,
  RARITY_STAT_MULTIPLIER,
  RARITY_MAX_STAT,
  RARITY_ORDER,
  PITY_RARE_THRESHOLD,
  PITY_EPIC_THRESHOLD,
  MULTI_PULL_DISCOUNTS,
} from "./constants";
import { spawnShard } from "./shard";

export interface PityState {
  totalPulls: number;
  pullsSinceRare: number;
  pullsSinceEpic: number;
}

/**
 * Determine rarity from a summon pull based on tier, pity state, and a random seed [0,1).
 */
export function determineSummonRarity(
  tier: SummonTier,
  pity: PityState,
  seed: number
): { rarity: ShardRarity; isGuaranteed: boolean } {
  // Pity guarantees — only apply for paid tiers
  if (tier !== SummonTier.Common) {
    if (pity.pullsSinceEpic >= PITY_EPIC_THRESHOLD) {
      // Guarantee Epic or above — use the tier's rates but only among Epic+
      const epicIdx = RARITY_ORDER.indexOf(ShardRarity.Epic);
      const rates = SUMMON_DROP_RATES[tier];
      const epicPlusRarities = RARITY_ORDER.slice(epicIdx);
      const totalWeight = epicPlusRarities.reduce((sum, r) => sum + rates[r], 0);

      if (totalWeight > 0) {
        let cumulative = 0;
        for (const r of epicPlusRarities) {
          cumulative += rates[r] / totalWeight;
          if (seed < cumulative) return { rarity: r, isGuaranteed: true };
        }
      }
      return { rarity: ShardRarity.Epic, isGuaranteed: true };
    }

    if (pity.pullsSinceRare >= PITY_RARE_THRESHOLD) {
      // Guarantee Rare or above
      const rareIdx = RARITY_ORDER.indexOf(ShardRarity.Rare);
      const rates = SUMMON_DROP_RATES[tier];
      const rarePlusRarities = RARITY_ORDER.slice(rareIdx);
      const totalWeight = rarePlusRarities.reduce((sum, r) => sum + rates[r], 0);

      if (totalWeight > 0) {
        let cumulative = 0;
        for (const r of rarePlusRarities) {
          cumulative += rates[r] / totalWeight;
          if (seed < cumulative) return { rarity: r, isGuaranteed: true };
        }
      }
      return { rarity: ShardRarity.Rare, isGuaranteed: true };
    }
  }

  // Normal roll
  const rates = SUMMON_DROP_RATES[tier];
  let cumulative = 0;
  for (const rarity of RARITY_ORDER) {
    cumulative += rates[rarity];
    if (seed < cumulative) return { rarity, isGuaranteed: false };
  }

  // Fallback (floating point edge case)
  return { rarity: ShardRarity.Common, isGuaranteed: false };
}

/**
 * Apply rarity stat multiplier and cap to shard stats.
 */
export function applyRarityMultiplier(stats: ShardStats, rarity: ShardRarity): ShardStats {
  const multiplier = RARITY_STAT_MULTIPLIER[rarity];
  const maxStat = RARITY_MAX_STAT[rarity];

  return {
    intelligence: Math.min(Math.round(stats.intelligence * multiplier), maxStat),
    creativity: Math.min(Math.round(stats.creativity * multiplier), maxStat),
    precision: Math.min(Math.round(stats.precision * multiplier), maxStat),
    resilience: Math.min(Math.round(stats.resilience * multiplier), maxStat),
    charisma: Math.min(Math.round(stats.charisma * multiplier), maxStat),
  };
}

/**
 * Spawn a shard from a summon pull. Applies rarity multipliers and marks as not wild.
 */
export function spawnSummonedShard(
  tier: SummonTier,
  rarity: ShardRarity,
  seed?: string
): Shard {
  const shard = spawnShard(seed, `summon-${tier}-${Date.now()}`);
  const boostedStats = applyRarityMultiplier(shard.stats, rarity);

  return {
    ...shard,
    stats: boostedStats,
    rarity,
    isWild: false,
  };
}

/**
 * Calculate cost for a multi-pull. Returns cost in ETH.
 */
export function calculateMultiPullCost(tier: SummonTier, count: number): number {
  const baseCost = SUMMON_COSTS[tier] * count;
  const discount = MULTI_PULL_DISCOUNTS[count] ?? 0;
  return baseCost * (1 - discount);
}
