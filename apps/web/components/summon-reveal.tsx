"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  type Shard,
  type SummonResult,
  ShardRarity,
  getShardTypeName,
  RARITY_COLORS,
} from "@siphon/core";

const rarityLabel: Record<ShardRarity, string> = {
  [ShardRarity.Common]: "Common",
  [ShardRarity.Rare]: "Rare",
  [ShardRarity.Epic]: "Epic",
  [ShardRarity.Legendary]: "Legendary",
  [ShardRarity.Mythic]: "Mythic",
};

const rarityGlow: Record<ShardRarity, string> = {
  [ShardRarity.Common]: "",
  [ShardRarity.Rare]: "shadow-[0_0_30px_rgba(59,130,246,0.4)]",
  [ShardRarity.Epic]: "shadow-[0_0_30px_rgba(168,85,247,0.5)]",
  [ShardRarity.Legendary]: "shadow-[0_0_40px_rgba(245,158,11,0.5)]",
  [ShardRarity.Mythic]: "shadow-[0_0_50px_rgba(239,68,68,0.6)] animate-pulse",
};

const rarityBorder: Record<ShardRarity, string> = {
  [ShardRarity.Common]: "border-ghost/20",
  [ShardRarity.Rare]: "border-blue-500/50",
  [ShardRarity.Epic]: "border-purple-500/50",
  [ShardRarity.Legendary]: "border-amber-500/50",
  [ShardRarity.Mythic]: "border-red-500/60",
};

function RevealCard({
  result,
  revealed,
  onReveal,
}: {
  result: SummonResult;
  revealed: boolean;
  onReveal: () => void;
}) {
  const { shard, rarity, isGuaranteed } = result;
  const color = RARITY_COLORS[rarity];
  const typeName = getShardTypeName(shard.type);

  return (
    <div
      className={cn(
        "relative cursor-pointer transition-all duration-500",
        revealed ? "scale-100" : "scale-95 hover:scale-100"
      )}
      onClick={onReveal}
    >
      <Card
        className={cn(
          "overflow-hidden transition-all duration-500 border-2",
          revealed ? rarityBorder[rarity] : "border-siphon-teal/20",
          revealed ? rarityGlow[rarity] : ""
        )}
      >
        {!revealed ? (
          <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
            <div className="w-16 h-16 rounded-full bg-siphon-teal/10 border-2 border-siphon-teal/30 flex items-center justify-center animate-pulse">
              <span className="text-2xl text-siphon-teal">?</span>
            </div>
            <p className="text-ghost text-xs mt-3">Tap to reveal</p>
          </CardContent>
        ) : (
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                style={{
                  backgroundColor: color + "20",
                  color,
                  boxShadow: `0 0 15px ${color}40`,
                }}
              >
                {"\u25C8"}
              </div>
              <div className="flex items-center gap-1">
                {isGuaranteed && (
                  <Badge variant="secondary" className="text-[10px] border-amber-500/50 text-amber-400">
                    PITY
                  </Badge>
                )}
                <Badge
                  className="text-[10px]"
                  style={{
                    backgroundColor: color + "20",
                    color,
                    borderColor: color + "50",
                  }}
                >
                  {rarityLabel[rarity]}
                </Badge>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-foam text-sm">{shard.name}</h3>
              <p className="text-xs text-ghost">
                {shard.species} &middot; {typeName}
              </p>
            </div>
            <div className="grid grid-cols-5 gap-1 text-[10px] text-center">
              <div>
                <div className="text-ghost">INT</div>
                <div className="font-mono text-foam">{shard.stats.intelligence}</div>
              </div>
              <div>
                <div className="text-ghost">CRE</div>
                <div className="font-mono text-foam">{shard.stats.creativity}</div>
              </div>
              <div>
                <div className="text-ghost">PRE</div>
                <div className="font-mono text-foam">{shard.stats.precision}</div>
              </div>
              <div>
                <div className="text-ghost">RES</div>
                <div className="font-mono text-foam">{shard.stats.resilience}</div>
              </div>
              <div>
                <div className="text-ghost">CHA</div>
                <div className="font-mono text-foam">{shard.stats.charisma}</div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export function SummonReveal({
  results,
  onComplete,
}: {
  results: SummonResult[];
  onComplete?: () => void;
}) {
  const [revealedIndexes, setRevealedIndexes] = useState<Set<number>>(new Set());
  const allRevealed = revealedIndexes.size === results.length;

  const revealCard = (index: number) => {
    setRevealedIndexes((prev) => new Set(prev).add(index));
  };

  const revealAll = () => {
    setRevealedIndexes(new Set(results.map((_, i) => i)));
  };

  useEffect(() => {
    if (allRevealed && onComplete) {
      const timer = setTimeout(onComplete, 1000);
      return () => clearTimeout(timer);
    }
  }, [allRevealed, onComplete]);

  // Auto-reveal single pulls
  useEffect(() => {
    if (results.length === 1) {
      const timer = setTimeout(() => revealCard(0), 500);
      return () => clearTimeout(timer);
    }
  }, [results.length]);

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "grid gap-3",
          results.length === 1
            ? "grid-cols-1 max-w-xs mx-auto"
            : results.length <= 5
            ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-5"
            : "grid-cols-2 sm:grid-cols-3 md:grid-cols-5"
        )}
      >
        {results.map((result, i) => (
          <RevealCard
            key={i}
            result={result}
            revealed={revealedIndexes.has(i)}
            onReveal={() => revealCard(i)}
          />
        ))}
      </div>
      {results.length > 1 && !allRevealed && (
        <div className="text-center">
          <button
            onClick={revealAll}
            className="text-sm text-ghost hover:text-foam underline transition-colors"
          >
            Reveal all
          </button>
        </div>
      )}
    </div>
  );
}
