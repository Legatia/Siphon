"use client";

import { useState, useEffect, useCallback } from "react";
import type { ReputationEntry } from "@siphon/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ReputationData {
  tokenId: string;
  reputation: number;
  validationCount: number;
  history: ReputationEntry[];
}

type Tier = "Newcomer" | "Trusted" | "Verified" | "Elite";

interface TierConfig {
  label: Tier;
  minScore: number;
  color: string;
  borderGradient: string;
  glowColor: string;
  badgeClass: string;
}

const TIERS: TierConfig[] = [
  {
    label: "Elite",
    minScore: 100,
    color: "#f59e0b",
    borderGradient: "from-amber-500 via-yellow-400 to-amber-500",
    glowColor: "rgba(245,158,11,0.25)",
    badgeClass: "border-ember/30 bg-ember/10 text-ember",
  },
  {
    label: "Verified",
    minScore: 50,
    color: "#7c3aed",
    borderGradient: "from-deep-violet via-purple-400 to-deep-violet",
    glowColor: "rgba(124,58,237,0.25)",
    badgeClass: "border-deep-violet/30 bg-deep-violet/10 text-deep-violet",
  },
  {
    label: "Trusted",
    minScore: 10,
    color: "#3b82f6",
    borderGradient: "from-blue-500 via-blue-400 to-blue-500",
    glowColor: "rgba(59,130,246,0.25)",
    badgeClass: "border-current/30 bg-current/10 text-current",
  },
  {
    label: "Newcomer",
    minScore: -Infinity,
    color: "#94a3b8",
    borderGradient: "from-ghost/40 via-ghost/20 to-ghost/40",
    glowColor: "rgba(148,163,184,0.15)",
    badgeClass: "border-ghost/30 bg-ghost/10 text-ghost",
  },
];

function getTier(score: number): TierConfig {
  return TIERS.find((t) => score >= t.minScore) ?? TIERS[TIERS.length - 1];
}

export function ReputationDisplay({ tokenId }: { tokenId: string }) {
  const [data, setData] = useState<ReputationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReputation = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/identity/${tokenId}/reputation`);
      if (!res.ok) {
        throw new Error(`Failed to fetch reputation: ${res.status}`);
      }
      const json: ReputationData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reputation");
    } finally {
      setLoading(false);
    }
  }, [tokenId]);

  useEffect(() => {
    fetchReputation();
  }, [fetchReputation]);

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 w-32 bg-ghost/10 rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-16 w-24 bg-ghost/10 rounded mx-auto" />
            <div className="h-4 w-20 bg-ghost/10 rounded mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-red-400 text-center">
            {error ?? "Failed to load reputation data"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const tier = getTier(data.reputation);

  return (
    <div
      className="rounded-xl p-[1px]"
      style={{
        background: `linear-gradient(135deg, ${tier.color}40, transparent 50%, ${tier.color}40)`,
        boxShadow: `0 0 30px ${tier.glowColor}`,
      }}
    >
      <Card className="rounded-xl border-0 bg-midnight/95">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-ghost">
              Agent Reputation
            </CardTitle>
            <Badge className={cn("text-xs", tier.badgeClass)}>
              {tier.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-2">
            {/* Reputation score */}
            <div className="text-center">
              <div
                className="text-5xl font-bold font-mono tracking-tight"
                style={{ color: tier.color }}
              >
                {data.reputation}
              </div>
              <p className="text-xs text-ghost mt-1">reputation score</p>
            </div>

            {/* Divider */}
            <div
              className="w-16 h-[1px]"
              style={{
                background: `linear-gradient(90deg, transparent, ${tier.color}60, transparent)`,
              }}
            />

            {/* Stats row */}
            <div className="flex items-center gap-6 text-center">
              <div>
                <div className="text-lg font-mono font-semibold text-foam">
                  {data.validationCount}
                </div>
                <p className="text-xs text-ghost">validations</p>
              </div>
              <div
                className="w-[1px] h-8"
                style={{ backgroundColor: `${tier.color}30` }}
              />
              <div>
                <div className="text-lg font-mono font-semibold text-foam">
                  {data.history.length}
                </div>
                <p className="text-xs text-ghost">events</p>
              </div>
            </div>

            {/* Token ID */}
            <div className="w-full pt-2 border-t border-siphon-teal/10">
              <p className="text-xs text-ghost text-center font-mono truncate">
                {tokenId}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
