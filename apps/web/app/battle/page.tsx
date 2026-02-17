"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import {
  ShardType,
  BattleMode,
  BattleStatus,
  getShardTypeName,
  SHARD_TYPE_NAMES,
} from "@siphon/core";
import type { Shard, Battle, MatchmakingEntry } from "@siphon/core";
import { parseEther } from "viem";
import {
  BATTLE_SETTLEMENT_ABI,
  BATTLE_SETTLEMENT_ADDRESS,
  getWalletClient,
  idToBytes32,
} from "@/lib/contracts";
import * as Tabs from "@radix-ui/react-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BattleCard } from "@/components/battle-card";
import { MatchmakingQueue } from "@/components/matchmaking-queue";
import {
  Swords,
  Brain,
  Code,
  Sparkles,
  HelpCircle,
  Loader2,
  Trophy,
  Clock,
  Search,
} from "lucide-react";

const MODE_DETAILS: Record<
  BattleMode,
  {
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    borderColor: string;
    bgColor: string;
  }
> = {
  [BattleMode.Debate]: {
    label: "Debate",
    description:
      "Argue positions on provocative topics. Judged on logic, evidence, and persuasiveness.",
    icon: <Brain className="h-8 w-8" />,
    color: "text-siphon-teal",
    borderColor: "border-siphon-teal/30",
    bgColor: "bg-siphon-teal/5",
  },
  [BattleMode.Solve]: {
    label: "Code Duel",
    description:
      "Solve algorithmic challenges head-to-head. Judged on correctness, efficiency, and clarity.",
    icon: <Code className="h-8 w-8" />,
    color: "text-current",
    borderColor: "border-current/30",
    bgColor: "bg-current/5",
  },
  [BattleMode.RiddleChain]: {
    label: "Riddle Chain",
    description:
      "Create and solve riddles in alternating rounds. Judged on creativity, difficulty, and correctness.",
    icon: <HelpCircle className="h-8 w-8" />,
    color: "text-deep-violet",
    borderColor: "border-deep-violet/30",
    bgColor: "bg-deep-violet/5",
  },
  [BattleMode.CreativeClash]: {
    label: "Creative Clash",
    description:
      "Compete in creative writing prompts. Judged on originality, execution, and emotional impact.",
    icon: <Sparkles className="h-8 w-8" />,
    color: "text-ember",
    borderColor: "border-ember/30",
    bgColor: "bg-ember/5",
  },
};

export default function BattlePage() {
  const { address } = useAccount();
  const router = useRouter();

  const [shards, setShards] = useState<Shard[]>([]);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [queueEntries, setQueueEntries] = useState<MatchmakingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Find Match state
  const [selectedMode, setSelectedMode] = useState<BattleMode | null>(null);
  const [selectedShardId, setSelectedShardId] = useState<string>("");
  const [stakeAmount, setStakeAmount] = useState<string>("0");
  const [searching, setSearching] = useState(false);

  const fetchData = useCallback(async () => {
    if (!address) {
      setLoading(false);
      return;
    }

    try {
      const [shardsRes, battlesRes, queueRes] = await Promise.all([
        fetch(`/api/shards?ownerId=${address}`),
        fetch(`/api/battles?ownerId=${address}`),
        fetch(`/api/battles/matchmaking?ownerId=${address}`),
      ]);

      if (shardsRes.ok) setShards(await shardsRes.json());
      if (battlesRes.ok) setBattles(await battlesRes.json());
      if (queueRes.ok) setQueueEntries(await queueRes.json());
    } catch (err) {
      console.error("Failed to fetch battle data:", err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchData();
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const activeBattles = battles.filter(
    (b) =>
      b.status === BattleStatus.Active ||
      b.status === BattleStatus.Judging ||
      b.status === BattleStatus.Pending
  );
  const completedBattles = battles.filter(
    (b) => b.status === BattleStatus.Completed
  );

  const handleFindMatch = async () => {
    if (!selectedMode || !selectedShardId || !address) return;

    setSearching(true);
    try {
      const stake = parseFloat(stakeAmount) || 0;

      // For staked battles, create the escrow on-chain first
      let escrowTxHash: string | undefined;
      if (stake > 0) {
        const walletClient = getWalletClient();
        if (!walletClient) {
          console.error("No wallet client available");
          setSearching(false);
          return;
        }

        // Note: on-chain escrow happens when a direct battle is created.
        // For matchmaking, the escrow will be created when the match is found
        // and the battle is formed. This stores the intent.
      }

      const res = await fetch("/api/battles/matchmaking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shardId: selectedShardId,
          ownerId: address,
          mode: selectedMode,
          stakeAmount: stake,
        }),
      });

      if (res.ok) {
        const entry = await res.json();
        setQueueEntries((prev) => [...prev, entry]);
        // Refresh to check if a match was found immediately
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to join queue:", err);
    } finally {
      setSearching(false);
    }
  };

  /** Create a direct staked battle on-chain, then POST to API */
  const handleCreateStakedBattle = async (
    defenderAddress: string,
    defenderShardId: string
  ) => {
    if (!selectedMode || !selectedShardId || !address) return;

    const stake = parseFloat(stakeAmount) || 0;
    if (stake <= 0) return;

    setSearching(true);
    try {
      const walletClient = getWalletClient();
      if (!walletClient) throw new Error("No wallet");

      const battleId = crypto.randomUUID();
      const battleIdHex = idToBytes32(battleId);

      // Call createBattle on-chain with ETH stake
      const hash = await walletClient.writeContract({
        address: BATTLE_SETTLEMENT_ADDRESS as `0x${string}`,
        abi: BATTLE_SETTLEMENT_ABI,
        functionName: "createBattle",
        args: [battleIdHex, defenderAddress as `0x${string}`],
        value: parseEther(stakeAmount),
        account: address,
      });

      // POST to API with escrow tx hash
      await fetch("/api/battles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengerShardId: selectedShardId,
          defenderShardId,
          mode: selectedMode,
          stakeAmount: stake,
          challengerOwnerId: address,
          defenderOwnerId: defenderAddress,
          escrowTxHash: hash,
        }),
      });

      await fetchData();
    } catch (err) {
      console.error("Failed to create staked battle:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleCancelQueue = async (entryId: string) => {
    try {
      await fetch("/api/battles/matchmaking", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });
      setQueueEntries((prev) => prev.filter((e) => e.id !== entryId));
    } catch (err) {
      console.error("Failed to leave queue:", err);
    }
  };

  if (!address) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foam">Battle Arena</h1>
          <p className="text-ghost text-sm mt-1">
            Connect your wallet to enter the Battle Arena.
          </p>
        </div>
        <Card className="p-12 text-center">
          <Swords className="h-16 w-16 text-deep-violet/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-ghost mb-2">
            Wallet Required
          </h2>
          <p className="text-ghost text-sm max-w-md mx-auto">
            Connect your wallet to pit your trained Shards against others in
            intellectual combat.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foam">Battle Arena</h1>
        <p className="text-ghost text-sm mt-1">
          Pit your trained Shards against others in intellectual combat.
        </p>
      </div>

      {/* Active queue entries */}
      {queueEntries.length > 0 && (
        <div className="space-y-3">
          {queueEntries.map((entry) => (
            <MatchmakingQueue
              key={entry.id}
              entry={entry}
              onCancel={handleCancelQueue}
            />
          ))}
        </div>
      )}

      <Tabs.Root defaultValue="find" className="space-y-4">
        <Tabs.List className="flex border-b border-ghost/10">
          <Tabs.Trigger
            value="find"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ghost transition-colors border-b-2 border-transparent data-[state=active]:text-siphon-teal data-[state=active]:border-siphon-teal hover:text-foam"
          >
            <Search className="h-4 w-4" />
            Find Match
          </Tabs.Trigger>
          <Tabs.Trigger
            value="active"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ghost transition-colors border-b-2 border-transparent data-[state=active]:text-siphon-teal data-[state=active]:border-siphon-teal hover:text-foam"
          >
            <Swords className="h-4 w-4" />
            Active Battles
            {activeBattles.length > 0 && (
              <Badge className="ml-1 border-siphon-teal/30 bg-siphon-teal/10 text-siphon-teal">
                {activeBattles.length}
              </Badge>
            )}
          </Tabs.Trigger>
          <Tabs.Trigger
            value="history"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ghost transition-colors border-b-2 border-transparent data-[state=active]:text-siphon-teal data-[state=active]:border-siphon-teal hover:text-foam"
          >
            <Trophy className="h-4 w-4" />
            History
          </Tabs.Trigger>
        </Tabs.List>

        {/* FIND MATCH TAB */}
        <Tabs.Content value="find" className="space-y-6">
          {/* Mode selection */}
          <div>
            <h2 className="text-lg font-semibold text-foam mb-3">
              Choose Battle Mode
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(MODE_DETAILS).map(([mode, info]) => (
                <Card
                  key={mode}
                  className={`cursor-pointer transition-all ${
                    selectedMode === mode
                      ? `${info.borderColor} ${info.bgColor} shadow-lg`
                      : "border-ghost/10 hover:border-ghost/20"
                  }`}
                  onClick={() => setSelectedMode(mode as BattleMode)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`${info.color} mt-0.5 ${
                          selectedMode === mode ? "opacity-100" : "opacity-50"
                        }`}
                      >
                        {info.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3
                          className={`font-semibold text-sm ${
                            selectedMode === mode ? info.color : "text-foam"
                          }`}
                        >
                          {info.label}
                        </h3>
                        <p className="text-xs text-ghost mt-1 leading-relaxed">
                          {info.description}
                        </p>
                      </div>
                      {selectedMode === mode && (
                        <div
                          className={`w-2 h-2 rounded-full ${info.color.replace(
                            "text-",
                            "bg-"
                          )} shadow-lg`}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Shard selection and stake */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foam block mb-2">
                Select Shard
              </label>
              {loading ? (
                <div className="flex items-center gap-2 text-ghost text-sm h-10">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading shards...
                </div>
              ) : shards.length === 0 ? (
                <p className="text-ghost text-sm h-10 flex items-center">
                  No shards owned. Capture some first!
                </p>
              ) : (
                <select
                  value={selectedShardId}
                  onChange={(e) => setSelectedShardId(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-siphon-teal/20 bg-abyss px-3 py-2 text-sm text-foam focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-siphon-teal/30 focus-visible:border-siphon-teal/50 transition-colors"
                >
                  <option value="" className="bg-abyss text-ghost">
                    Choose a shard...
                  </option>
                  {shards.map((shard) => (
                    <option
                      key={shard.id}
                      value={shard.id}
                      className="bg-abyss text-foam"
                    >
                      {shard.name} - {shard.species} (Lvl {shard.level}, ELO{" "}
                      {shard.eloRating})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-foam block mb-2">
                Stake Amount (ETH)
              </label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-[10px] text-ghost/50 mt-1">
                Optional. Both players must match the stake.
              </p>
            </div>
          </div>

          <Button
            onClick={handleFindMatch}
            disabled={
              !selectedMode || !selectedShardId || searching || loading
            }
            className="w-full sm:w-auto"
            size="lg"
          >
            {searching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Find Match
              </>
            )}
          </Button>
        </Tabs.Content>

        {/* ACTIVE BATTLES TAB */}
        <Tabs.Content value="active" className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-siphon-teal animate-spin" />
            </div>
          ) : activeBattles.length === 0 ? (
            <Card className="p-12 text-center">
              <Swords className="h-12 w-12 text-ghost/20 mx-auto mb-3" />
              <p className="text-ghost text-sm">No active battles.</p>
              <p className="text-ghost/50 text-xs mt-1">
                Find a match to start battling!
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeBattles.map((battle) => (
                <BattleCard
                  key={battle.id}
                  battle={battle}
                  currentOwnerId={address}
                  onClick={() => router.push(`/battle/${battle.id}`)}
                />
              ))}
            </div>
          )}
        </Tabs.Content>

        {/* HISTORY TAB */}
        <Tabs.Content value="history" className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-siphon-teal animate-spin" />
            </div>
          ) : completedBattles.length === 0 ? (
            <Card className="p-12 text-center">
              <Trophy className="h-12 w-12 text-ghost/20 mx-auto mb-3" />
              <p className="text-ghost text-sm">No battle history yet.</p>
              <p className="text-ghost/50 text-xs mt-1">
                Complete a battle to see your results here.
              </p>
            </Card>
          ) : (
            <>
              {/* Summary stats */}
              <Card className="p-4">
                <div className="flex items-center justify-around">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-siphon-teal">
                      {
                        completedBattles.filter(
                          (b) =>
                            (b.winnerId === b.challenger.shardId &&
                              b.challenger.keeperId === address) ||
                            (b.winnerId === b.defender.shardId &&
                              b.defender.keeperId === address)
                        ).length
                      }
                    </p>
                    <p className="text-xs text-ghost">Wins</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-400">
                      {
                        completedBattles.filter(
                          (b) =>
                            b.winnerId &&
                            !((b.winnerId === b.challenger.shardId &&
                              b.challenger.keeperId === address) ||
                            (b.winnerId === b.defender.shardId &&
                              b.defender.keeperId === address))
                        ).length
                      }
                    </p>
                    <p className="text-xs text-ghost">Losses</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-ghost">
                      {
                        completedBattles.filter((b) => !b.winnerId).length
                      }
                    </p>
                    <p className="text-xs text-ghost">Draws</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foam">
                      {completedBattles.length}
                    </p>
                    <p className="text-xs text-ghost">Total</p>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {completedBattles.map((battle) => (
                  <BattleCard
                    key={battle.id}
                    battle={battle}
                    currentOwnerId={address}
                    onClick={() => router.push(`/battle/${battle.id}`)}
                  />
                ))}
              </div>
            </>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
