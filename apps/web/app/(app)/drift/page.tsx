"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount } from "wagmi";
import type { WildShard } from "@siphon/core";
import { DriftMap } from "@/components/drift-map";
import { CaptureDialog } from "@/components/capture-challenge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw, Compass, Target } from "lucide-react";
import { updateOnboardingProgress } from "@/lib/game-feedback";
import Link from "next/link";

export default function DriftPage() {
  const { address } = useAccount();
  const [wildShards, setWildShards] = useState<WildShard[]>([]);
  const [selectedShard, setSelectedShard] = useState<WildShard | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadShards = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/shards/wild");
    const data = await res.json();
    setWildShards(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadShards();
  }, [loadShards]);

  useEffect(() => {
    if (address) updateOnboardingProgress(address, { driftVisited: true });
  }, [address]);

  const handleShardClick = (shard: WildShard) => {
    if (!address) return;
    setSelectedShard(shard);
    setCaptureOpen(true);
  };

  const handleCaptured = () => {
    // Remove captured shard from wild list
    if (selectedShard) {
      setWildShards((prev) => prev.filter((s) => s.id !== selectedShard.id));
    }
    setSelectedShard(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="pixel-title text-[14px] text-foam">The Drift</h1>
          <p className="mt-2 text-ghost">
            Wild Shards are drifting through the digital deep. Click one to
            begin capture.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadShards} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="reveal-up" style={{ animationDelay: "70ms" }}>
        <DriftMap shards={wildShards} onShardClick={handleShardClick} />
      </div>

      {!address && (
        <Card className="border-siphon-teal/25 bg-[#071123]/85 p-4 text-center reveal-up" style={{ animationDelay: "120ms" }}>
          <Compass className="h-8 w-8 text-siphon-teal/30 mx-auto mb-2" />
          <p className="text-ghost">
            Connect your wallet to capture wild Shards.
          </p>
        </Card>
      )}

      <div className="pixel-panel px-4 py-2 text-center reveal-up float-gentle" style={{ animationDelay: "150ms" }}>
        <span className="text-xs uppercase tracking-wider text-ghost">
          {wildShards.length} wild shards detected in range
        </span>
      </div>

      {address && (
        <Card className="border-siphon-teal/25 bg-[#071123]/85 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-siphon-teal">Operator Route</p>
              <p className="text-ghost mt-1">
                After capture, train your shard and move to a live bounty for real payout.
              </p>
            </div>
            <Link href="/bounties">
              <Button size="sm">
                <Target className="h-4 w-4 mr-2" />
                Live Bounties
              </Button>
            </Link>
          </div>
        </Card>
      )}

      <CaptureDialog
        shard={selectedShard}
        open={captureOpen}
        onClose={() => {
          setCaptureOpen(false);
          setSelectedShard(null);
        }}
        onCaptured={handleCaptured}
        ownerId={address ?? ""}
      />
    </div>
  );
}
