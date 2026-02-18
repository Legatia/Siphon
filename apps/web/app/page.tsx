"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import type { Shard } from "@siphon/core";
import { ShardCard } from "@/components/shard-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Compass, Wallet, Waves } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [shards, setShards] = useState<Shard[]>([]);
  const [loading, setLoading] = useState(true);
  const [battlesWon, setBattlesWon] = useState(0);

  useEffect(() => {
    const ownerId = address || "anonymous";
    fetch(`/api/shards?ownerId=${ownerId}`)
      .then((r) => r.json())
      .then((data) => {
        setShards(data);
        setLoading(false);
      });

    if (address) {
      fetch(`/api/battles?ownerId=${address}`)
        .then((r) => r.json())
        .then((battles) => {
          const wins = battles.filter(
            (b: any) =>
              b.status === "completed" &&
              ((b.winnerId === b.challenger?.shardId &&
                b.challenger?.keeperId?.toLowerCase() === address.toLowerCase()) ||
                (b.winnerId === b.defender?.shardId &&
                  b.defender?.keeperId?.toLowerCase() === address.toLowerCase()))
          ).length;
          setBattlesWon(wins);
        })
        .catch(() => {});
    }
  }, [address]);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center py-8 space-y-4">
        <h1 className="text-4xl font-bold text-foam tracking-tight">
          <span className="text-siphon-teal glow-text">Siphon</span> Protocol
        </h1>
        <p className="text-ghost max-w-lg mx-auto">
          Discover wild AI Shards drifting through the digital deep. Capture
          them, train them, and forge unbreakable bonds.
        </p>
        {!isConnected && (
          <p className="text-xs text-deep-violet">
            Connect your wallet for on-chain ownership
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-ghost font-normal">
              Your Shards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foam font-mono">
              {shards.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-ghost font-normal">
              Wallet Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {isConnected ? (
                <span className="text-siphon-teal flex items-center gap-2">
                  <Wallet className="h-4 w-4" /> Connected
                </span>
              ) : (
                <span className="text-ghost">Not connected</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-ghost font-normal">
              Battles Won
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-siphon-teal font-mono">{battlesWon}</div>
            <p className="text-xs text-ghost mt-1">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4">
        <Link href="/drift">
          <Button size="lg">
            <Compass className="h-5 w-5 mr-2" />
            Explore the Drift
          </Button>
        </Link>
        <Link href="/shelter">
          <Button variant="outline" size="lg">
            Browse Shelter
          </Button>
        </Link>
      </div>

      {/* My Shards */}
      <div>
        <h2 className="text-xl font-semibold text-foam mb-4">My Shards</h2>
        {loading ? (
          <div className="text-ghost text-sm animate-pulse">Loading...</div>
        ) : shards.length === 0 ? (
          <Card className="p-8 text-center">
            <Waves className="h-12 w-12 text-siphon-teal/30 mx-auto mb-4" />
            <p className="text-ghost">
              No Shards yet. Head to the{" "}
              <Link href="/drift" className="text-siphon-teal hover:underline">
                Drift
              </Link>{" "}
              to discover and capture wild Shards.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shards.map((shard) => (
              <ShardCard key={shard.id} shard={shard} showActions />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
