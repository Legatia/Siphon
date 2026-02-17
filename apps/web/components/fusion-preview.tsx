"use client";

import {
  type Shard,
  type ShardStats,
  ShardType,
  canFuse,
  calculateFusionType,
  calculateFusionStats,
  getShardTypeName,
  SHARD_TYPE_COLORS,
  SHARD_TYPE_NAMES,
  PROTOCOL_CONSTANTS,
} from "@siphon/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const typeIconMap: Record<number, string> = {
  0: "\u25C8", // Oracle
  1: "\u25C7", // Cipher
  2: "\u25A3", // Scribe
  3: "\u2726", // Muse
  4: "\u25B3", // Architect
  5: "\u2660", // Advocate
  6: "\u25C6", // Sentinel
  7: "\u25CE", // Mirror
};

function StatBar({ label, value, max = 150 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ghost w-8 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-abyss overflow-hidden">
        <div
          className="h-full rounded-full bg-siphon-teal transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-foam w-8 text-right">{value}</span>
    </div>
  );
}

function MiniShardSlot({ shard, label }: { shard: Shard; label: string }) {
  const typeName = getShardTypeName(shard.type);
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-ghost">{label}</span>
      <div
        className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl border border-siphon-teal/20"
        style={{
          backgroundColor: shard.avatar.primaryColor + "15",
          color: shard.avatar.primaryColor,
          boxShadow: `0 0 ${shard.avatar.glowIntensity * 20}px ${shard.avatar.primaryColor}30`,
        }}
      >
        {typeIconMap[shard.type] || "\u25C8"}
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-foam truncate max-w-[80px]">{shard.name}</p>
        <p className="text-[10px] text-ghost">Lv.{shard.level} {typeName}</p>
      </div>
    </div>
  );
}

export function FusionPreview({
  shardA,
  shardB,
}: {
  shardA: Shard | null;
  shardB: Shard | null;
}) {
  // Not enough shards selected
  if (!shardA || !shardB) {
    return (
      <Card className="border-dashed border-siphon-teal/10">
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-6">
            <div className="w-16 h-16 rounded-xl border border-dashed border-siphon-teal/20 flex items-center justify-center text-ghost text-2xl">
              ?
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="text-ghost text-lg">+</div>
              <svg
                className="w-6 h-6 text-ghost/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </div>
            <div className="w-16 h-16 rounded-xl border border-dashed border-siphon-teal/20 flex items-center justify-center text-ghost text-2xl">
              ?
            </div>
          </div>
          <p className="text-ghost text-xs text-center mt-4">
            Select two shards to preview fusion compatibility
          </p>
        </CardContent>
      </Card>
    );
  }

  const fusionCheck = canFuse(shardA, shardB);
  const resultType = fusionCheck.canFuse ? calculateFusionType(shardA, shardB) : null;
  const resultStats = fusionCheck.canFuse ? calculateFusionStats(shardA, shardB) : null;
  const resultTypeName = resultType !== null ? SHARD_TYPE_NAMES[resultType] : null;
  const resultColor = resultTypeName ? SHARD_TYPE_COLORS[resultTypeName] : "#94a3b8";

  return (
    <Card
      className={cn(
        "transition-all duration-300",
        fusionCheck.canFuse
          ? "border-siphon-teal/30 shadow-[0_0_25px_rgba(0,212,170,0.08)]"
          : "border-red-500/20"
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          Fusion Preview
          {fusionCheck.canFuse ? (
            <Badge variant="default">Compatible</Badge>
          ) : (
            <Badge
              className="border-red-500/30 bg-red-500/10 text-red-400"
            >
              Incompatible
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Visual: parent A -> ? <- parent B */}
        <div className="flex items-center justify-center gap-4">
          <MiniShardSlot shard={shardA} label="Parent A" />

          <div className="flex flex-col items-center gap-1 px-2">
            <svg
              className="w-5 h-5 text-siphon-teal/60 -rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>

            {/* Result card */}
            <div
              className={cn(
                "w-20 h-20 rounded-xl flex items-center justify-center text-3xl border transition-all duration-500",
                fusionCheck.canFuse
                  ? "border-siphon-teal/30 animate-pulse"
                  : "border-red-500/20"
              )}
              style={
                fusionCheck.canFuse && resultColor
                  ? {
                      backgroundColor: resultColor + "15",
                      color: resultColor,
                      boxShadow: `0 0 25px ${resultColor}25`,
                    }
                  : {
                      backgroundColor: "#94a3b815",
                      color: "#94a3b8",
                    }
              }
            >
              {fusionCheck.canFuse && resultType !== null
                ? typeIconMap[resultType] || "\u25C8"
                : "\u2715"}
            </div>

            <svg
              className="w-5 h-5 text-siphon-teal/60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </div>

          <MiniShardSlot shard={shardB} label="Parent B" />
        </div>

        {/* Incompatible reason */}
        {!fusionCheck.canFuse && fusionCheck.reason && (
          <div className="text-center px-4 py-2 rounded-lg bg-red-500/5 border border-red-500/10">
            <p className="text-xs text-red-400">{fusionCheck.reason}</p>
          </div>
        )}

        {/* Predicted results */}
        {fusionCheck.canFuse && resultStats && resultTypeName && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ghost">Predicted Type</span>
              <span className="font-medium" style={{ color: resultColor }}>
                {resultTypeName}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-ghost">Predicted Level</span>
              <span className="font-mono text-foam">
                {Math.max(1, Math.floor((shardA.level + shardB.level) / 2) - 2)}
              </span>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-ghost">Predicted Stats</p>
              <StatBar label="INT" value={resultStats.intelligence} />
              <StatBar label="CRE" value={resultStats.creativity} />
              <StatBar label="PRE" value={resultStats.precision} />
              <StatBar label="RES" value={resultStats.resilience} />
              <StatBar label="CHA" value={resultStats.charisma} />
            </div>

            <p className="text-[10px] text-ghost/60 text-center">
              Stats include a 10% fusion bonus. Both parent shards will be consumed.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
