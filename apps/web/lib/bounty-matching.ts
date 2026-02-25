import type { Shard } from "@siphon/core";

export interface BountyMatch {
  shardId: string;
  shardName: string;
  score: number;
  reasons: string[];
}

const KEYWORD_WEIGHTS: Array<{ pattern: RegExp; stat: keyof Shard["stats"]; weight: number; reason: string }> = [
  { pattern: /\b(code|debug|implement|refactor|api|backend|frontend|typescript|react)\b/i, stat: "precision", weight: 1.2, reason: "Technical implementation demand" },
  { pattern: /\b(write|copy|content|article|summary|story|script|brand)\b/i, stat: "creativity", weight: 1.1, reason: "Creative/language composition demand" },
  { pattern: /\b(analy[sz]e|research|insight|report|audit|compare|evaluate)\b/i, stat: "intelligence", weight: 1.15, reason: "Analytical reasoning demand" },
  { pattern: /\b(pitch|sales|negotiat|outreach|community|support)\b/i, stat: "charisma", weight: 1.0, reason: "Communication/persuasion demand" },
  { pattern: /\b(reliab|incident|ops|monitor|security|sre|hardening)\b/i, stat: "resilience", weight: 1.0, reason: "Operational reliability demand" },
];

function normalizeStat(v: number) {
  return Math.min(1, Math.max(0, v / 120));
}

export function rankShardsForBounty(description: string, shards: Shard[]): BountyMatch[] {
  const matched = KEYWORD_WEIGHTS.filter((k) => k.pattern.test(description));
  const statBoost: Partial<Record<keyof Shard["stats"], number>> = {};

  for (const rule of matched) {
    statBoost[rule.stat] = (statBoost[rule.stat] ?? 0) + rule.weight;
  }

  const matches = shards.map((shard) => {
    const baseStatScore =
      normalizeStat(shard.stats.intelligence) * 0.2 +
      normalizeStat(shard.stats.creativity) * 0.2 +
      normalizeStat(shard.stats.precision) * 0.22 +
      normalizeStat(shard.stats.resilience) * 0.18 +
      normalizeStat(shard.stats.charisma) * 0.2;

    let weightedLift = 0;
    const reasons: string[] = [];

    for (const [statKey, boost] of Object.entries(statBoost) as Array<[keyof Shard["stats"], number]>) {
      const val = normalizeStat(shard.stats[statKey]);
      weightedLift += val * boost * 0.12;
      if (val >= 0.72) reasons.push(`${statKey} is strong for this task`);
    }

    const eloScore = Math.min(1, (shard.eloRating ?? 1200) / 1800) * 0.12;
    const levelScore = Math.min(1, shard.level / 20) * 0.08;

    const score = Math.round((baseStatScore + weightedLift + eloScore + levelScore) * 100);

    if (matched.length > 0) {
      reasons.push(matched[0]!.reason);
    }
    if ((shard.eloRating ?? 1200) >= 1300) {
      reasons.push("Higher battle-proven rating");
    }
    if (shard.level >= 4) {
      reasons.push("Matured through training progression");
    }

    return {
      shardId: shard.id,
      shardName: shard.name,
      score,
      reasons: Array.from(new Set(reasons)).slice(0, 3),
    } satisfies BountyMatch;
  });

  return matches.sort((a, b) => b.score - a.score);
}
