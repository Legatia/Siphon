"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount } from "wagmi";
import type { WildShard } from "@siphon/core";
import { DriftMap } from "@/components/drift-map";
import { CaptureDialog } from "@/components/capture-challenge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

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

  const handleShardClick = (shard: WildShard) => {
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
          <h1 className="text-2xl font-bold text-foam">The Drift</h1>
          <p className="text-ghost text-sm mt-1">
            Wild Shards are drifting through the digital deep. Click one to
            begin capture.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadShards} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <DriftMap shards={wildShards} onShardClick={handleShardClick} />

      <div className="text-xs text-ghost text-center">
        {wildShards.length} wild Shards detected in range
      </div>

      <CaptureDialog
        shard={selectedShard}
        open={captureOpen}
        onClose={() => {
          setCaptureOpen(false);
          setSelectedShard(null);
        }}
        onCaptured={handleCaptured}
        ownerId={address || "anonymous"}
      />
    </div>
  );
}
