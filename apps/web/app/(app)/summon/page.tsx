"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { parseEther, formatEther } from "viem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Clock, Info } from "lucide-react";
import {
  SummonTier,
  ShardRarity,
  SUMMON_COSTS,
  SUMMON_DROP_RATES,
  RARITY_COLORS,
  MULTI_PULL_DISCOUNTS,
  PITY_RARE_THRESHOLD,
  PITY_EPIC_THRESHOLD,
  type SummonResult,
} from "@siphon/core";
import {
  SUMMON_ESCROW_ABI,
  SUMMON_ESCROW_ADDRESS,
  getWalletClient,
  publicClient,
  idToBytes32,
} from "@/lib/contracts";
import { SummonReveal } from "@/components/summon-reveal";
import { useSmartWrite } from "@/hooks/use-smart-write";
import { toast } from "sonner";

interface PityInfo {
  totalPulls: number;
  pullsSinceRare: number;
  pullsSinceEpic: number;
  pullsUntilRareGuarantee: number;
  pullsUntilEpicGuarantee: number;
  freePullUsedToday: boolean;
}

const tierInfo = [
  {
    tier: SummonTier.Common,
    name: "Common Summon",
    description: "Free daily pull. Always yields a Common shard.",
    cost: 0,
    color: "#94a3b8",
  },
  {
    tier: SummonTier.Rare,
    name: "Rare Summon",
    description: "Chance at Rare and Epic shards.",
    cost: SUMMON_COSTS[SummonTier.Rare],
    color: "#3b82f6",
  },
  {
    tier: SummonTier.Elite,
    name: "Elite Summon",
    description: "No Commons. Strong chance at Epic and Legendary.",
    cost: SUMMON_COSTS[SummonTier.Elite],
    color: "#a855f7",
  },
  {
    tier: SummonTier.Legendary,
    name: "Legendary Summon",
    description: "Premium pull. Chance at Mythic shards.",
    cost: SUMMON_COSTS[SummonTier.Legendary],
    color: "#f59e0b",
  },
];

const rarityNames: ShardRarity[] = [
  ShardRarity.Common,
  ShardRarity.Rare,
  ShardRarity.Epic,
  ShardRarity.Legendary,
  ShardRarity.Mythic,
];

const rarityLabels: Record<ShardRarity, string> = {
  [ShardRarity.Common]: "Common",
  [ShardRarity.Rare]: "Rare",
  [ShardRarity.Epic]: "Epic",
  [ShardRarity.Legendary]: "Legendary",
  [ShardRarity.Mythic]: "Mythic",
};

export default function SummonPage() {
  const { address, isConnected } = useAccount();
  const { smartWrite, isSmartWallet } = useSmartWrite();

  const [pity, setPity] = useState<PityInfo | null>(null);
  const [results, setResults] = useState<SummonResult[] | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [showReveal, setShowReveal] = useState(false);

  const fetchPity = useCallback(async () => {
    if (!isConnected) return;
    try {
      const res = await fetch("/api/shards/summon/pity");
      if (res.ok) setPity(await res.json());
    } catch {}
  }, [isConnected]);

  useEffect(() => {
    fetchPity();
  }, [fetchPity]);

  const performSummon = async (tier: SummonTier, count: number) => {
    if (!address) {
      toast.error("Connect your wallet first");
      return;
    }

    const key = `${tier}-${count}`;
    setLoading(key);
    setResults(null);
    setShowReveal(false);

    try {
      let txHash: string | undefined;

      // Paid tiers need on-chain payment
      if (tier !== SummonTier.Common) {
        const totalCost =
          SUMMON_COSTS[tier] * count * (1 - (MULTI_PULL_DISCOUNTS[count] ?? 0));
        const summonId = idToBytes32(crypto.randomUUID());

        if (isSmartWallet) {
          const callResult = await smartWrite([
            {
              address: SUMMON_ESCROW_ADDRESS,
              abi: SUMMON_ESCROW_ABI,
              functionName: "purchaseSummon",
              args: [summonId, tier],
              value: parseEther(totalCost.toString()),
            },
          ]);
          txHash = callResult?.id ?? undefined;
        } else {
          const walletClient = await getWalletClient();
          if (!walletClient) {
            toast.error("Wallet not available");
            setLoading(null);
            return;
          }

          txHash = await walletClient.writeContract({
            address: SUMMON_ESCROW_ADDRESS,
            abi: SUMMON_ESCROW_ABI,
            functionName: "purchaseSummon",
            args: [summonId, tier],
            value: parseEther(totalCost.toString()),
            chain: undefined,
            account: address,
          });

          toast.info("Transaction sent, waiting for confirmation...");
          await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
        }
      }

      // Call API
      const res = await fetch("/api/shards/summon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          count,
          txHash,
          ownerId: address.toLowerCase(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Summon failed");
        setLoading(null);
        return;
      }

      const data = await res.json();
      const summonResults: SummonResult[] = Array.isArray(data?.results) ? data.results : [];
      setResults(summonResults);
      setShowReveal(true);
      const pityData = data?.pity ?? {};
      setPity({
        ...pity!,
        ...pityData,
        pullsUntilRareGuarantee: Math.max(0, PITY_RARE_THRESHOLD - (pityData.pullsSinceRare ?? 0)),
        pullsUntilEpicGuarantee: Math.max(0, PITY_EPIC_THRESHOLD - (pityData.pullsSinceEpic ?? 0)),
        freePullUsedToday: tier === SummonTier.Common ? true : pity?.freePullUsedToday ?? false,
      });

      const rarities = summonResults.map((r: SummonResult) => r.rarity);
      const bestRarity = rarities.includes(ShardRarity.Mythic)
        ? "Mythic"
        : rarities.includes(ShardRarity.Legendary)
        ? "Legendary"
        : rarities.includes(ShardRarity.Epic)
        ? "Epic"
        : rarities.includes(ShardRarity.Rare)
        ? "Rare"
        : "Common";
      toast.success(`Summoned ${count} shard${count > 1 ? "s" : ""}! Best: ${bestRarity}`);
    } catch (err: any) {
      if (err?.message?.includes("User rejected") || err?.message?.includes("denied")) {
        toast.error("Transaction cancelled");
      } else {
        toast.error("Summon failed: " + (err?.message ?? "Unknown error"));
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-siphon-teal" />
          <h1 className="pixel-title text-xl text-foam">Summon Chamber</h1>
        </div>
        <p className="text-ghost text-sm max-w-lg mx-auto">
          Channel the deep currents to summon shards. Higher tiers yield rarer, more powerful shards
          with boosted stats.
        </p>
      </div>

      {/* Pity tracker */}
      {pity && (
        <Card className="max-w-lg mx-auto">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-ghost" />
              <span className="text-xs text-ghost font-medium">Pity Progress</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-ghost">Next guaranteed </span>
                <span style={{ color: RARITY_COLORS[ShardRarity.Rare] }}>Rare+</span>
                <div className="font-mono text-foam mt-1">
                  {pity.pullsUntilRareGuarantee === 0
                    ? "Next pull!"
                    : `${pity.pullsUntilRareGuarantee} pulls`}
                </div>
              </div>
              <div>
                <span className="text-ghost">Next guaranteed </span>
                <span style={{ color: RARITY_COLORS[ShardRarity.Epic] }}>Epic+</span>
                <div className="font-mono text-foam mt-1">
                  {pity.pullsUntilEpicGuarantee === 0
                    ? "Next pull!"
                    : `${pity.pullsUntilEpicGuarantee} pulls`}
                </div>
              </div>
            </div>
            <div className="text-[10px] text-ghost mt-2">
              Total summons: {pity.totalPulls}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reveal area */}
      {showReveal && results && (
        <div className="py-4">
          <SummonReveal
            results={results}
            onComplete={() => {
              // keep showing
            }}
          />
        </div>
      )}

      {/* Tier cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tierInfo.map((info) => {
          const rates = SUMMON_DROP_RATES[info.tier];
          const isCommon = info.tier === SummonTier.Common;
          const freePullUsed = pity?.freePullUsedToday ?? false;

          return (
            <Card
              key={info.tier}
              className="border-2 transition-all hover:border-opacity-50"
              style={{ borderColor: info.color + "30" }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle
                    className="text-sm font-bold"
                    style={{ color: info.color }}
                  >
                    {info.name}
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="text-[10px]"
                    style={{ borderColor: info.color + "50", color: info.color }}
                  >
                    {isCommon ? "FREE" : `${info.cost} ETH`}
                  </Badge>
                </div>
                <p className="text-xs text-ghost">{info.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Drop rates */}
                <div className="space-y-1">
                  {rarityNames.map((rarity) => {
                    const rate = rates[rarity];
                    if (rate === 0) return null;
                    return (
                      <div key={rarity} className="flex items-center justify-between text-[10px]">
                        <span style={{ color: RARITY_COLORS[rarity] }}>
                          {rarityLabels[rarity]}
                        </span>
                        <span className="font-mono text-ghost">
                          {(rate * 100).toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Summon buttons */}
                <div className="space-y-2">
                  {isCommon ? (
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={
                        !isConnected || freePullUsed || loading !== null
                      }
                      onClick={() => performSummon(info.tier, 1)}
                    >
                      {loading === `${info.tier}-1` ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : null}
                      {freePullUsed ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Used today
                        </span>
                      ) : (
                        "Summon 1x (Free)"
                      )}
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={!isConnected || loading !== null}
                        onClick={() => performSummon(info.tier, 1)}
                      >
                        {loading === `${info.tier}-1` ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : null}
                        1x &middot; {info.cost} ETH
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-[10px]"
                          disabled={!isConnected || loading !== null}
                          onClick={() => performSummon(info.tier, 5)}
                        >
                          {loading === `${info.tier}-5` ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : null}
                          5x (-10%)
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-[10px]"
                          disabled={!isConnected || loading !== null}
                          onClick={() => performSummon(info.tier, 10)}
                        >
                          {loading === `${info.tier}-10` ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : null}
                          10x (-15%)
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!isConnected && (
        <div className="text-center py-8">
          <p className="text-ghost text-sm">Connect your wallet to start summoning.</p>
        </div>
      )}
    </div>
  );
}
