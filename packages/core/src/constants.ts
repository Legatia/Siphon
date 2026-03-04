import { Specialization, ShardRarity, SummonTier } from "./types";

export const PROTOCOL_CONSTANTS = {
  MIN_STAKE: 0.01,
  DECAY_RATE: 0.001,
  DECAY_RATE_PER_WEEK: 0.01,
  SPECIALIZATION_LEVEL: 20,
  MAX_LEVEL: 100,
  XP_PER_INTERACTION: 10,
  XP_PER_LEVEL_BASE: 100,
  XP_LEVEL_MULTIPLIER: 1.5,
  CAPTURE_TIME_LIMIT_MS: 60_000,
  DRIFT_SPAWN_INTERVAL_MS: 30_000,
  MAX_WILD_SHARDS: 20,
  SHARD_TYPES: 8,
  SPECIES_COUNT: 20,
  FUSION_MIN_LEVEL: 15,
  FUSION_XP_COST: 5000,
  BATTLE_ROUNDS: 3,
  BATTLE_TURN_TIME_LIMIT_MS: 90_000,
} as const;

export const SHARD_TYPE_NAMES = [
  "Oracle", "Cipher", "Scribe", "Muse",
  "Architect", "Advocate", "Sentinel", "Mirror",
] as const;

export const SEA_CREATURE_SPECIES = [
  "Abyssal Jellyfish",
  "Lantern Squid",
  "Phantom Ray",
  "Crystal Nautilus",
  "Ember Eel",
  "Void Angler",
  "Sapphire Seahorse",
  "Drift Medusa",
  "Prism Cuttlefish",
  "Shadow Leviathan",
  "Biolume Starfish",
  "Echo Dolphin",
  "Coral Wraith",
  "Vortex Mantis",
  "Glacial Kraken",
  "Neon Serpent",
  "Tidal Chimera",
  "Obsidian Urchin",
  "Spectral Whale",
  "Luminous Polyp",
] as const;

export const SHARD_TYPE_COLORS: Record<string, string> = {
  Oracle: "#00d4aa",
  Cipher: "#7c3aed",
  Scribe: "#3b82f6",
  Muse: "#f59e0b",
  Architect: "#06b6d4",
  Advocate: "#ec4899",
  Sentinel: "#ef4444",
  Mirror: "#a855f7",
} as const;

export const SPECIALIZATION_BRANCHES: Record<number, [Specialization, Specialization]> = {
  0: [Specialization.Prophet, Specialization.Analyst],
  1: [Specialization.Builder, Specialization.Auditor],
  2: [Specialization.Chronicler, Specialization.Translator],
  3: [Specialization.Visionary, Specialization.Artisan],
  4: [Specialization.Diplomat, Specialization.Litigator],
  5: [Specialization.Breaker, Specialization.Warden],
  6: [Specialization.Verifier, Specialization.Watchdog],
  7: [Specialization.Counselor, Specialization.Infiltrator],
};

// --- Summon / Gacha constants ---

/** ETH cost per summon tier (Common is free) */
export const SUMMON_COSTS: Record<SummonTier, number> = {
  [SummonTier.Common]: 0,
  [SummonTier.Rare]: 0.005,
  [SummonTier.Elite]: 0.02,
  [SummonTier.Legendary]: 0.05,
};

/** Drop rates per tier: [common, rare, epic, legendary, mythic] — must sum to 1 */
export const SUMMON_DROP_RATES: Record<SummonTier, Record<ShardRarity, number>> = {
  [SummonTier.Common]: {
    [ShardRarity.Common]: 1.0,
    [ShardRarity.Rare]: 0,
    [ShardRarity.Epic]: 0,
    [ShardRarity.Legendary]: 0,
    [ShardRarity.Mythic]: 0,
  },
  [SummonTier.Rare]: {
    [ShardRarity.Common]: 0.6,
    [ShardRarity.Rare]: 0.35,
    [ShardRarity.Epic]: 0.05,
    [ShardRarity.Legendary]: 0,
    [ShardRarity.Mythic]: 0,
  },
  [SummonTier.Elite]: {
    [ShardRarity.Common]: 0,
    [ShardRarity.Rare]: 0.5,
    [ShardRarity.Epic]: 0.4,
    [ShardRarity.Legendary]: 0.1,
    [ShardRarity.Mythic]: 0,
  },
  [SummonTier.Legendary]: {
    [ShardRarity.Common]: 0,
    [ShardRarity.Rare]: 0,
    [ShardRarity.Epic]: 0.6,
    [ShardRarity.Legendary]: 0.35,
    [ShardRarity.Mythic]: 0.05,
  },
};

export const RARITY_STAT_MULTIPLIER: Record<ShardRarity, number> = {
  [ShardRarity.Common]: 1.0,
  [ShardRarity.Rare]: 1.15,
  [ShardRarity.Epic]: 1.3,
  [ShardRarity.Legendary]: 1.45,
  [ShardRarity.Mythic]: 1.6,
};

export const RARITY_MAX_STAT: Record<ShardRarity, number> = {
  [ShardRarity.Common]: 100,
  [ShardRarity.Rare]: 105,
  [ShardRarity.Epic]: 110,
  [ShardRarity.Legendary]: 115,
  [ShardRarity.Mythic]: 130,
};

export const RARITY_XP_BONUS: Record<ShardRarity, number> = {
  [ShardRarity.Common]: 1.0,
  [ShardRarity.Rare]: 1.1,
  [ShardRarity.Epic]: 1.2,
  [ShardRarity.Legendary]: 1.3,
  [ShardRarity.Mythic]: 1.5,
};

export const PITY_RARE_THRESHOLD = 10;
export const PITY_EPIC_THRESHOLD = 50;

export const MULTI_PULL_DISCOUNTS: Record<number, number> = {
  5: 0.1,
  10: 0.15,
};

export const RARITY_COLORS: Record<ShardRarity, string> = {
  [ShardRarity.Common]: "#94a3b8",
  [ShardRarity.Rare]: "#3b82f6",
  [ShardRarity.Epic]: "#a855f7",
  [ShardRarity.Legendary]: "#f59e0b",
  [ShardRarity.Mythic]: "#ef4444",
};

export const RARITY_ORDER: ShardRarity[] = [
  ShardRarity.Common,
  ShardRarity.Rare,
  ShardRarity.Epic,
  ShardRarity.Legendary,
  ShardRarity.Mythic,
];

export const THEME = {
  abyss: "#0f0f1a",
  midnight: "#1a1a2e",
  siphonTeal: "#00d4aa",
  deepViolet: "#7c3aed",
  foam: "#ffffff",
  ghost: "#94a3b8",
  ember: "#f59e0b",
  current: "#3b82f6",
} as const;
