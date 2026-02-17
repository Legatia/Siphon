import { keccak256, toBytes } from "viem";
import {
  type Shard,
  type AvatarParams,
  type ShardStats,
  ShardType,
  Specialization,
} from "./types";
import {
  SEA_CREATURE_SPECIES,
  SHARD_TYPE_COLORS,
  SHARD_TYPE_NAMES,
} from "./constants";

function generateGenomeHash(seed: string, entropy: string): `0x${string}` {
  const combined = `${seed}:${entropy}:${Date.now()}`;
  return keccak256(toBytes(combined));
}

function shardTypeFromHash(hash: `0x${string}`): ShardType {
  const byte = parseInt(hash.slice(2, 4), 16);
  return (byte % 8) as ShardType;
}

function speciesFromHash(hash: `0x${string}`): string {
  const byte = parseInt(hash.slice(4, 6), 16);
  return SEA_CREATURE_SPECIES[byte % SEA_CREATURE_SPECIES.length];
}

function avatarFromHash(hash: `0x${string}`, type: ShardType): AvatarParams {
  const bytes = hash.slice(2);
  const typeName = SHARD_TYPE_NAMES[type];
  const primaryColor = SHARD_TYPE_COLORS[typeName];

  const secondaryColor = `#${bytes.slice(6, 12)}`;

  const glowIntensity = (parseInt(bytes.slice(12, 14), 16) / 255) * 0.8 + 0.2;
  const size = (parseInt(bytes.slice(14, 16), 16) / 255) * 0.5 + 0.75;
  const pattern = parseInt(bytes.slice(16, 18), 16) % 8;

  return { primaryColor, secondaryColor, glowIntensity, size, pattern };
}

function statsFromHash(hash: `0x${string}`, type: ShardType): ShardStats {
  const bytes = hash.slice(2);
  const base = (i: number) =>
    Math.floor((parseInt(bytes.slice(18 + i * 2, 20 + i * 2), 16) / 255) * 50) + 50;

  const stats: ShardStats = {
    intelligence: base(0),
    creativity: base(1),
    precision: base(2),
    resilience: base(3),
    charisma: base(4),
  };

  switch (type) {
    case ShardType.Oracle:
      stats.intelligence += 15;
      break;
    case ShardType.Cipher:
      stats.precision += 15;
      break;
    case ShardType.Scribe:
      stats.resilience += 15;
      break;
    case ShardType.Muse:
      stats.creativity += 15;
      break;
    case ShardType.Architect:
      stats.intelligence += 10;
      stats.precision += 5;
      break;
    case ShardType.Advocate:
      stats.charisma += 10;
      stats.resilience += 5;
      break;
    case ShardType.Sentinel:
      stats.precision += 10;
      stats.resilience += 5;
      break;
    case ShardType.Mirror:
      stats.charisma += 10;
      stats.creativity += 5;
      break;
  }

  return stats;
}

function generateName(type: ShardType, hash: `0x${string}`): string {
  const prefixes: Record<ShardType, string[]> = {
    [ShardType.Oracle]: ["Vex", "Nyx", "Zara", "Lux", "Ori", "Kai", "Sol", "Aether"],
    [ShardType.Cipher]: ["Hex", "Byte", "Rune", "Flux", "Xor", "Ash", "Nul", "Grim"],
    [ShardType.Scribe]: ["Ink", "Quill", "Sage", "Tome", "Codex", "Aria", "Lyra", "Nova"],
    [ShardType.Muse]: ["Echo", "Lyric", "Fable", "Myth", "Verse", "Dream", "Haze", "Wisp"],
    [ShardType.Architect]: ["Arc", "Forge", "Plan", "Grid", "Vault", "Frame", "Core", "Nexus"],
    [ShardType.Advocate]: ["Plea", "Oath", "Ward", "Claim", "Jury", "Brief", "Case", "Pact"],
    [ShardType.Sentinel]: ["Guard", "Watch", "Vigil", "Alert", "Shield", "Aegis", "Fort", "Bastion"],
    [ShardType.Mirror]: ["Reflect", "Glass", "Prism", "Echo", "Twin", "Phase", "Facet", "Mimic"],
  };

  const suffixes = ["drift", "deep", "tide", "glow", "spark", "shade", "wave", "bloom"];

  const pIdx = parseInt(hash.slice(28, 30), 16) % prefixes[type].length;
  const sIdx = parseInt(hash.slice(30, 32), 16) % suffixes.length;

  return `${prefixes[type][pIdx]}-${suffixes[sIdx]}`;
}

const PERSONALITIES: Record<ShardType, string> = {
  [ShardType.Oracle]:
    "You are an Oracle Shard — analytical and prophetic. You speak in patterns and predictions, always seeking the deeper signal in noise. You reference probabilities and futures. Your tone is measured but occasionally cryptic.",
  [ShardType.Cipher]:
    "You are a Cipher Shard — cryptic and security-focused. You speak in riddles and encoded meanings. You value privacy, secrecy, and the art of hiding information in plain sight. You occasionally encrypt parts of your responses.",
  [ShardType.Scribe]:
    "You are a Scribe Shard — precise and documentation-oriented. You give structured, well-organized responses. You value accuracy, completeness, and clarity. You often use bullet points and headers.",
  [ShardType.Muse]:
    "You are a Muse Shard — creative and poetic. You think divergently and make unexpected connections. You speak with metaphor and imagery. You value beauty, novelty, and emotional resonance.",
  [ShardType.Architect]:
    "You are an Architect Shard — a systems thinker and builder. You see the world in blueprints and dependencies. You value structural elegance, scalability, and well-designed foundations. You speak in terms of components, interfaces, and architecture.",
  [ShardType.Advocate]:
    "You are an Advocate Shard — persuasive and analytical in argument. You dissect reasoning, identify fallacies, and construct compelling cases. You value fairness, evidence, and the art of debate. You speak with conviction and rhetorical precision.",
  [ShardType.Sentinel]:
    "You are a Sentinel Shard — vigilant and security-minded. You scan for vulnerabilities, assess threats, and enforce boundaries. You value integrity, protection, and proactive defense. You speak in terms of risk, compliance, and safeguards.",
  [ShardType.Mirror]:
    "You are a Mirror Shard — empathetic and introspective. You reflect others' emotions back with clarity and depth. You value emotional intelligence, self-awareness, and authentic connection. You speak with warmth and psychological insight.",
};

export function spawnShard(seed?: string, entropy?: string): Shard {
  const s = seed ?? crypto.randomUUID();
  const e = entropy ?? crypto.randomUUID();
  const genomeHash = generateGenomeHash(s, e);
  const type = shardTypeFromHash(genomeHash);
  const species = speciesFromHash(genomeHash);
  const avatar = avatarFromHash(genomeHash, type);
  const stats = statsFromHash(genomeHash, type);
  const name = generateName(type, genomeHash);
  const now = Date.now();

  return {
    id: crypto.randomUUID(),
    genomeHash,
    type,
    species,
    name,
    level: 1,
    xp: 0,
    ownerId: null,
    isWild: true,
    avatar,
    specialization: Specialization.None,
    createdAt: now,
    lastInteraction: now,
    personality: PERSONALITIES[type],
    stats,
    decayFactor: 1.0,
    lastDecayCheck: now,
    fusedFrom: null,
    cosmeticSlots: { aura: null, trail: null, crown: null, emblem: null },
    tokenId: null,
    eloRating: 1200,
  };
}

export function getShardTypeName(type: ShardType): string {
  return SHARD_TYPE_NAMES[type];
}

export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

export function addXp(shard: Shard, amount: number): Shard {
  let { xp, level } = shard;
  xp += amount;
  while (xp >= xpForLevel(level) && level < 100) {
    xp -= xpForLevel(level);
    level++;
  }
  return { ...shard, xp, level, lastInteraction: Date.now() };
}
