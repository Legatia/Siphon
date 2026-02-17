import { type Shard, type ShardStats } from "./types";
import { PROTOCOL_CONSTANTS } from "./constants";

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export function calculateDecay(
  lastInteraction: number,
  currentDecayFactor: number,
  now: number = Date.now()
): number {
  const elapsed = now - lastInteraction;
  const weeks = elapsed / MS_PER_WEEK;

  if (weeks < 1) return currentDecayFactor;

  const decay = currentDecayFactor * Math.pow(1 - PROTOCOL_CONSTANTS.DECAY_RATE_PER_WEEK, weeks);
  return Math.max(0.1, decay);
}

export function applyDecayToStats(stats: ShardStats, decayFactor: number): ShardStats {
  if (decayFactor >= 1.0) return stats;

  return {
    intelligence: Math.floor(stats.intelligence * decayFactor),
    creativity: Math.floor(stats.creativity * decayFactor),
    precision: Math.floor(stats.precision * decayFactor),
    resilience: Math.floor(stats.resilience * decayFactor),
    charisma: Math.floor(stats.charisma * decayFactor),
  };
}

export function resetDecay(shard: Shard): Shard {
  return {
    ...shard,
    decayFactor: 1.0,
    lastDecayCheck: Date.now(),
    lastInteraction: Date.now(),
  };
}
