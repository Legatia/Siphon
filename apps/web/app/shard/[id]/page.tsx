"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Shard } from "@siphon/core";
import { getShardTypeName, xpForLevel, SHARD_TYPE_COLORS, PROTOCOL_CONSTANTS, SPECIALIZATION_BRANCHES } from "@siphon/core";
import { applyDecayToStats } from "@siphon/core";
import { TrainingChat } from "@/components/training-chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Sparkles, Shield, Loader2 } from "lucide-react";
import { useAccount } from "wagmi";
import {
  SIPHON_IDENTITY_ABI,
  SIPHON_IDENTITY_ADDRESS,
  getWalletClient,
  publicClient,
} from "@/lib/contracts";
import { ShardType, Specialization } from "@siphon/core";

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

export default function ShardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { address } = useAccount();
  const [shard, setShard] = useState<Shard | null>(null);
  const [loading, setLoading] = useState(true);
  const [specDialogOpen, setSpecDialogOpen] = useState(false);
  const [minting, setMinting] = useState(false);

  useEffect(() => {
    fetch(`/api/shards/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          router.push("/");
          return;
        }
        setShard(data);
        setLoading(false);
      });
  }, [params.id, router]);

  const handleSpecialize = async (branch: 0 | 1) => {
    if (!shard) return;
    const res = await fetch(`/api/shards/${shard.id}/specialize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branch }),
    });
    const data = await res.json();
    if (data.id) {
      setShard(data);
      setSpecDialogOpen(false);
    }
  };

  const handleMintAgent = async () => {
    if (!shard || !address) return;
    setMinting(true);
    try {
      // Phase 1: Get genome hash from API
      const res = await fetch("/api/identity/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shardId: shard.id, ownerId: shard.ownerId }),
      });
      const data = await res.json();

      if (!res.ok) {
        // 409 = already minted, others = real errors
        if (res.status === 409) {
          console.log("Shard already has an identity token");
        } else {
          console.error("Mint error:", data.error);
        }
        return;
      }

      if (!data.needsOnChainMint) {
        if (data.shard) setShard(data.shard);
        return;
      }

      // Phase 2: Execute on-chain mint via wallet
      const walletClient = getWalletClient();
      if (!walletClient) throw new Error("No wallet connected");

      const hash = await walletClient.writeContract({
        address: SIPHON_IDENTITY_ADDRESS as `0x${string}`,
        abi: SIPHON_IDENTITY_ABI,
        functionName: "mintAgent",
        args: [data.genomeHash as `0x${string}`],
        account: address,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Extract tokenId from logs (Transfer event, topic[3] is tokenId)
      const transferLog = receipt.logs.find(
        (log) => log.topics.length >= 4
      );
      const tokenId = transferLog
        ? BigInt(transferLog.topics[3]!).toString()
        : "unknown";

      // Phase 3: Confirm with API
      const confirmRes = await fetch("/api/identity/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shardId: shard.id,
          ownerId: shard.ownerId,
          txHash: hash,
          tokenId,
        }),
      });
      const confirmData = await confirmRes.json();
      if (confirmData.shard) setShard(confirmData.shard);
    } catch (err) {
      console.error("Mint agent error:", err);
    } finally {
      setMinting(false);
    }
  };

  if (loading || !shard) {
    return (
      <div className="text-center py-20 text-ghost animate-pulse">
        Loading Shard data...
      </div>
    );
  }

  const typeName = getShardTypeName(shard.type);
  const color = SHARD_TYPE_COLORS[typeName];
  const xpNeeded = xpForLevel(shard.level);
  const xpPercent = Math.floor((shard.xp / xpNeeded) * 100);
  const effectiveStats = applyDecayToStats(shard.stats, shard.decayFactor ?? 1.0);
  const canSpecialize = shard.level >= PROTOCOL_CONSTANTS.SPECIALIZATION_LEVEL && shard.specialization === Specialization.None;
  const branches = SPECIALIZATION_BRANCHES[shard.type] ?? [];
  const daysSinceInteraction = Math.floor((Date.now() - shard.lastInteraction) / (1000 * 60 * 60 * 24));

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shard Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl"
                  style={{
                    backgroundColor: color + "20",
                    color: color,
                    boxShadow: `0 0 25px ${color}30`,
                  }}
                >
                  {typeIconMap[shard.type] ?? "\u25C8"}
                </div>
                <div>
                  <CardTitle>{shard.name}</CardTitle>
                  <p className="text-sm text-ghost">{shard.species}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Badge variant={typeVariantMap[shard.type]}>{typeName}</Badge>
                    {shard.specialization !== Specialization.None && (
                      <Badge variant="success">{shard.specialization}</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-ghost">Level {shard.level}</span>
                  <span className="text-ghost font-mono">
                    {shard.xp}/{xpNeeded} XP
                  </span>
                </div>
                <Progress value={xpPercent} />
              </div>

              {(shard.decayFactor ?? 1.0) < 0.95 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs">
                  <div className="text-red-400 font-medium">Decay Active ({Math.floor((shard.decayFactor ?? 1) * 100)}%)</div>
                  <div className="text-ghost mt-1">Last interaction: {daysSinceInteraction} days ago. Train to restore stats.</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                {(["intelligence", "creativity", "precision", "resilience", "charisma"] as const).map((stat) => (
                  <div key={stat} className="bg-abyss/60 rounded-lg p-3">
                    <div className="text-ghost text-xs capitalize">{stat}</div>
                    <div className="font-mono text-foam text-lg">
                      {effectiveStats[stat]}
                      {effectiveStats[stat] < shard.stats[stat] && (
                        <span className="text-xs text-red-400 ml-1">({shard.stats[stat]})</span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="bg-abyss/60 rounded-lg p-3">
                  <div className="text-ghost text-xs">Elo Rating</div>
                  <div className="font-mono text-foam text-lg">{shard.eloRating ?? 1200}</div>
                </div>
              </div>

              <div className="space-y-2">
                {canSpecialize && (
                  <Button className="w-full" variant="outline" onClick={() => setSpecDialogOpen(true)}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Specialize
                  </Button>
                )}
                {!shard.tokenId && (
                  <Button className="w-full" variant="outline" onClick={handleMintAgent} disabled={minting}>
                    <Shield className="h-4 w-4 mr-2" />
                    {minting ? "Minting..." : "Mint as Agent"}
                  </Button>
                )}
                {shard.tokenId && (
                  <div className="text-xs text-ghost font-mono bg-abyss/60 rounded-lg p-3">
                    Agent Token: {shard.tokenId}
                  </div>
                )}
              </div>

              <div className="text-xs text-ghost font-mono break-all">
                Genome: {shard.genomeHash.slice(0, 20)}...
              </div>
              {shard.fusedFrom && (
                <div className="text-xs text-ghost">Fused from 2 parent shards</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <TrainingChat shard={shard} onXpGain={(updated) => setShard(updated)} />
        </div>
      </div>

      <Dialog open={specDialogOpen} onOpenChange={setSpecDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Specialization</DialogTitle>
            <DialogDescription>
              Your {typeName} Shard has reached level {PROTOCOL_CONSTANTS.SPECIALIZATION_LEVEL}. Choose a branch. This is permanent.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {branches.map((branch, idx) => (
              <Card
                key={branch}
                className="cursor-pointer hover:border-siphon-teal/30 transition-colors"
                onClick={() => handleSpecialize(idx as 0 | 1)}
              >
                <CardContent className="p-4 text-center">
                  <div className="text-lg font-semibold text-foam capitalize">{branch}</div>
                  <div className="text-xs text-ghost mt-1">Branch {idx + 1}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
