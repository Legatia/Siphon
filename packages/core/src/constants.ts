import { Specialization } from "./types";

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
