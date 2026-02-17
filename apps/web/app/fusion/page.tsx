"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount } from "wagmi";
import type { Shard } from "@siphon/core";
import { getShardTypeName } from "@siphon/core";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FusionPreview } from "@/components/fusion-preview";
import { ShardCard } from "@/components/shard-card";
import { cn } from "@/lib/utils";

export default function FusionPage() {
  const { address } = useAccount();

  const [shards, setShards] = useState<Shard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedA, setSelectedA] = useState<string>("");
  const [selectedB, setSelectedB] = useState<string>("");
  const [fusing, setFusing] = useState(false);
  const [fusionResult, setFusionResult] = useState<Shard | null>(null);
  const [fusionError, setFusionError] = useState<string | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);

  const fetchShards = useCallback(() => {
    if (!address) {
      setShards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/shards?ownerId=${address}`)
      .then((r) => r.json())
      .then((data: Shard[]) => {
        setShards(data);
        setLoading(false);
      })
      .catch(() => {
        setShards([]);
        setLoading(false);
      });
  }, [address]);

  useEffect(() => {
    fetchShards();
  }, [fetchShards]);

  const shardA = shards.find((s) => s.id === selectedA) ?? null;
  const shardB = shards.find((s) => s.id === selectedB) ?? null;

  // Filter out the other selected shard from each dropdown
  const shardsForA = shards.filter((s) => s.id !== selectedB);
  const shardsForB = shards.filter((s) => s.id !== selectedA);

  const handleFuse = async () => {
    if (!shardA || !shardB || !address) return;

    setFusing(true);
    setFusionError(null);

    try {
      const res = await fetch("/api/fusion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shardIdA: shardA.id,
          shardIdB: shardB.id,
          ownerId: address,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFusionError(data.error || "Fusion failed");
        setFusing(false);
        return;
      }

      setFusionResult(data);
      setShowResultDialog(true);

      // Reset selections and reload shards
      setSelectedA("");
      setSelectedB("");
      fetchShards();
    } catch {
      setFusionError("Network error during fusion");
    } finally {
      setFusing(false);
    }
  };

  if (!address) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foam">Shard Fusion</h1>
          <p className="text-ghost text-sm mt-1">
            Merge two shards into a more powerful hybrid entity.
          </p>
        </div>
        <Card className="p-12 text-center">
          <div className="text-5xl mb-4 opacity-30">
            {"\u29D6"}
          </div>
          <p className="text-ghost">
            Connect your wallet to access the Fusion Chamber.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foam">Shard Fusion</h1>
        <p className="text-ghost text-sm mt-1">
          Merge two shards into a more powerful hybrid. Both parents must be level 15+.
          The resulting shard inherits averaged stats with a 10% fusion bonus.
        </p>
      </div>

      {loading ? (
        <div className="text-ghost text-sm animate-pulse">Loading your shards...</div>
      ) : shards.length < 2 ? (
        <Card className="p-12 text-center">
          <div className="text-5xl mb-4 opacity-30">
            {"\u29D6"}
          </div>
          <h2 className="text-lg font-semibold text-ghost mb-2">Not Enough Shards</h2>
          <p className="text-ghost text-sm max-w-md mx-auto">
            You need at least two owned shards to perform a fusion.
            Capture and train more shards from the Drift.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: selectors */}
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-foam uppercase tracking-wider">
              Select Shards
            </h2>

            {/* Shard A selector */}
            <div className="space-y-2">
              <label className="text-xs text-ghost">Parent Shard A</label>
              <Select value={selectedA} onValueChange={setSelectedA}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose first shard..." />
                </SelectTrigger>
                <SelectContent>
                  {shardsForA.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: s.avatar.primaryColor }}
                        />
                        <span>{s.name}</span>
                        <span className="text-ghost text-[10px]">
                          Lv.{s.level} {getShardTypeName(s.type)}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Shard B selector */}
            <div className="space-y-2">
              <label className="text-xs text-ghost">Parent Shard B</label>
              <Select value={selectedB} onValueChange={setSelectedB}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose second shard..." />
                </SelectTrigger>
                <SelectContent>
                  {shardsForB.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: s.avatar.primaryColor }}
                        />
                        <span>{s.name}</span>
                        <span className="text-ghost text-[10px]">
                          Lv.{s.level} {getShardTypeName(s.type)}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Error message */}
            {fusionError && (
              <div className="px-4 py-2 rounded-lg bg-red-500/5 border border-red-500/10">
                <p className="text-xs text-red-400">{fusionError}</p>
              </div>
            )}

            {/* Fuse button */}
            <Button
              className="w-full"
              size="lg"
              disabled={!shardA || !shardB || fusing}
              onClick={handleFuse}
            >
              {fusing ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-abyss/30 border-t-abyss rounded-full animate-spin" />
                  Fusing...
                </span>
              ) : (
                "Fuse Shards"
              )}
            </Button>
          </div>

          {/* Right column: fusion preview */}
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-foam uppercase tracking-wider">
              Compatibility Preview
            </h2>
            <FusionPreview shardA={shardA} shardB={shardB} />
          </div>
        </div>
      )}

      {/* Success dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Fusion Complete</DialogTitle>
            <DialogDescription className="text-center">
              A new shard has emerged from the fusion chamber.
            </DialogDescription>
          </DialogHeader>

          {fusionResult && (
            <div className="space-y-4">
              {/* Success animation glow */}
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-xl blur-xl opacity-30 animate-pulse"
                  style={{ backgroundColor: fusionResult.avatar.primaryColor }}
                />
                <ShardCard shard={fusionResult} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-abyss/50 p-3">
                  <span className="text-ghost">Type</span>
                  <p className="font-medium text-foam mt-0.5">
                    {getShardTypeName(fusionResult.type)}
                  </p>
                </div>
                <div className="rounded-lg bg-abyss/50 p-3">
                  <span className="text-ghost">Species</span>
                  <p className="font-medium text-foam mt-0.5">{fusionResult.species}</p>
                </div>
                <div className="rounded-lg bg-abyss/50 p-3">
                  <span className="text-ghost">Level</span>
                  <p className="font-medium text-foam mt-0.5">{fusionResult.level}</p>
                </div>
                <div className="rounded-lg bg-abyss/50 p-3">
                  <span className="text-ghost">ELO</span>
                  <p className="font-medium text-foam mt-0.5">{fusionResult.eloRating}</p>
                </div>
              </div>

              {fusionResult.fusedFrom && (
                <p className="text-[10px] text-ghost/60 text-center">
                  Born from the merging of two parent shards. Their essence lives on.
                </p>
              )}

              <Button
                className="w-full"
                variant="outline"
                onClick={() => setShowResultDialog(false)}
              >
                Return to Fusion Chamber
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
