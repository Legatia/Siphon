import { keccak256, toBytes } from "viem";
import {
  type Shard,
  type ShardStats,
  ShardType,
  Specialization,
} from "./types";
import { PROTOCOL_CONSTANTS, SEA_CREATURE_SPECIES, SHARD_TYPE_COLORS, SHARD_TYPE_NAMES } from "./constants";

export function canFuse(a: Shard, b: Shard): { canFuse: boolean; reason?: string } {
  if (a.id === b.id) {
    return { canFuse: false, reason: "Cannot fuse a shard with itself" };
  }
  if (a.level < PROTOCOL_CONSTANTS.FUSION_MIN_LEVEL) {
    return { canFuse: false, reason: `${a.name} must be level ${PROTOCOL_CONSTANTS.FUSION_MIN_LEVEL}+` };
  }
  if (b.level < PROTOCOL_CONSTANTS.FUSION_MIN_LEVEL) {
    return { canFuse: false, reason: `${b.name} must be level ${PROTOCOL_CONSTANTS.FUSION_MIN_LEVEL}+` };
  }
  if (a.isWild || b.isWild) {
    return { canFuse: false, reason: "Cannot fuse wild shards" };
  }
  if (a.ownerId !== b.ownerId) {
    return { canFuse: false, reason: "Both shards must have the same owner" };
  }
  return { canFuse: true };
}

export function calculateFusionType(a: Shard, b: Shard): ShardType {
  const byteA = parseInt(a.genomeHash.slice(2, 4), 16);
  const byteB = parseInt(b.genomeHash.slice(2, 4), 16);
  return ((byteA ^ byteB) % 8) as ShardType;
}

export function calculateFusionStats(a: Shard, b: Shard): ShardStats {
  const fusionBonus = 1.1;
  return {
    intelligence: Math.floor(((a.stats.intelligence + b.stats.intelligence) / 2) * fusionBonus),
    creativity: Math.floor(((a.stats.creativity + b.stats.creativity) / 2) * fusionBonus),
    precision: Math.floor(((a.stats.precision + b.stats.precision) / 2) * fusionBonus),
    resilience: Math.floor(((a.stats.resilience + b.stats.resilience) / 2) * fusionBonus),
    charisma: Math.floor(((a.stats.charisma + b.stats.charisma) / 2) * fusionBonus),
  };
}

export function performFusion(a: Shard, b: Shard): Shard {
  const combinedHash = keccak256(toBytes(`${a.genomeHash}:${b.genomeHash}`));
  const type = calculateFusionType(a, b);
  const stats = calculateFusionStats(a, b);
  const typeName = SHARD_TYPE_NAMES[type];

  const speciesByte = parseInt(combinedHash.slice(4, 6), 16);
  const species = SEA_CREATURE_SPECIES[speciesByte % SEA_CREATURE_SPECIES.length];

  const primaryColor = SHARD_TYPE_COLORS[typeName];
  const secondaryColor = `#${combinedHash.slice(8, 14)}`;
  const glowIntensity = (parseInt(combinedHash.slice(14, 16), 16) / 255) * 0.8 + 0.2;
  const size = (parseInt(combinedHash.slice(16, 18), 16) / 255) * 0.5 + 0.75;
  const pattern = parseInt(combinedHash.slice(18, 20), 16) % 8;

  const prefixes = ["Fusion", "Hybrid", "Merged", "Synth", "Dual", "Apex", "Prime", "Omni"];
  const suffixes = ["drift", "deep", "tide", "glow", "spark", "shade", "wave", "bloom"];
  const pIdx = parseInt(combinedHash.slice(28, 30), 16) % prefixes.length;
  const sIdx = parseInt(combinedHash.slice(30, 32), 16) % suffixes.length;
  const name = `${prefixes[pIdx]}-${suffixes[sIdx]}`;

  const now = Date.now();
  const fusionLevel = Math.max(1, Math.floor((a.level + b.level) / 2) - 2);

  return {
    id: crypto.randomUUID(),
    genomeHash: combinedHash,
    type,
    species,
    name,
    level: fusionLevel,
    xp: 0,
    ownerId: a.ownerId,
    isWild: false,
    avatar: { primaryColor, secondaryColor, glowIntensity, size, pattern },
    specialization: Specialization.None,
    createdAt: now,
    lastInteraction: now,
    personality: `You are a Fusion Shard born from the merging of ${a.name} and ${b.name}. You carry echoes of both parents — blending their traits into something new. You are unique, powerful, and still discovering your identity.`,
    stats,
    decayFactor: 1.0,
    lastDecayCheck: now,
    fusedFrom: [a.id, b.id],
    cosmeticSlots: { aura: null, trail: null, crown: null, emblem: null },
    tokenId: null,
    eloRating: Math.floor((a.eloRating + b.eloRating) / 2),
  };
}
