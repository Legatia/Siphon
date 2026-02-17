"use client";

import Link from "next/link";
import { type Shard, ShardType, getShardTypeName, xpForLevel } from "@siphon/core";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type BadgeVariant = "oracle" | "cipher" | "scribe" | "muse" | "architect" | "advocate" | "sentinel" | "mirror";

const typeVariantMap: Record<ShardType, BadgeVariant> = {
  [ShardType.Oracle]: "oracle",
  [ShardType.Cipher]: "cipher",
  [ShardType.Scribe]: "scribe",
  [ShardType.Muse]: "muse",
  [ShardType.Architect]: "architect",
  [ShardType.Advocate]: "advocate",
  [ShardType.Sentinel]: "sentinel",
  [ShardType.Mirror]: "mirror",
};

const typeGlowMap: Record<ShardType, string> = {
  [ShardType.Oracle]: "shadow-[0_0_20px_rgba(0,212,170,0.15)]",
  [ShardType.Cipher]: "shadow-[0_0_20px_rgba(124,58,237,0.15)]",
  [ShardType.Scribe]: "shadow-[0_0_20px_rgba(59,130,246,0.15)]",
  [ShardType.Muse]: "shadow-[0_0_20px_rgba(245,158,11,0.15)]",
  [ShardType.Architect]: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
  [ShardType.Advocate]: "shadow-[0_0_20px_rgba(236,72,153,0.15)]",
  [ShardType.Sentinel]: "shadow-[0_0_20px_rgba(239,68,68,0.15)]",
  [ShardType.Mirror]: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
};

const typeIconMap: Record<ShardType, string> = {
  [ShardType.Oracle]: "\u25C8",
  [ShardType.Cipher]: "\u25C7",
  [ShardType.Scribe]: "\u25A3",
  [ShardType.Muse]: "\u2726",
  [ShardType.Architect]: "\u2B21",
  [ShardType.Advocate]: "\u2696",
  [ShardType.Sentinel]: "\u26E8",
  [ShardType.Mirror]: "\u25D0",
};

export function ShardCard({
  shard,
  showActions = false,
  onClick,
}: {
  shard: Shard;
  showActions?: boolean;
  onClick?: () => void;
}) {
  const typeName = getShardTypeName(shard.type);
  const xpNeeded = xpForLevel(shard.level);
  const xpPercent = Math.floor((shard.xp / xpNeeded) * 100);
  const decayWarning = (shard.decayFactor ?? 1.0) < 0.95;

  const content = (
    <Card
      className={cn(
        "group cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:border-siphon-teal/30",
        typeGlowMap[shard.type]
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
              style={{
                backgroundColor: shard.avatar.primaryColor + "20",
                color: shard.avatar.primaryColor,
                boxShadow: `0 0 ${shard.avatar.glowIntensity * 15}px ${shard.avatar.primaryColor}40`,
              }}
            >
              {typeIconMap[shard.type] ?? "\u25C8"}
            </div>
            <div>
              <h3 className="font-semibold text-foam text-sm">{shard.name}</h3>
              <p className="text-xs text-ghost">{shard.species}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {decayWarning && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {Math.floor((shard.decayFactor ?? 1) * 100)}%
              </Badge>
            )}
            <Badge variant={typeVariantMap[shard.type]}>{typeName}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ghost">Level {shard.level}</span>
            <span className="text-ghost font-mono">
              {shard.xp}/{xpNeeded} XP
            </span>
          </div>
          <Progress value={xpPercent} />
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <div className="text-ghost">INT</div>
              <div className="font-mono text-foam">{shard.stats.intelligence}</div>
            </div>
            <div className="text-center">
              <div className="text-ghost">CRE</div>
              <div className="font-mono text-foam">{shard.stats.creativity}</div>
            </div>
            <div className="text-center">
              <div className="text-ghost">PRE</div>
              <div className="font-mono text-foam">{shard.stats.precision}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (showActions && !shard.isWild) {
    return <Link href={`/shard/${shard.id}`}>{content}</Link>;
  }

  return content;
}
