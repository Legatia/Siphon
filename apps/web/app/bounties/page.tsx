"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Plus,
  Loader2,
  Clock,
  Coins,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import type { Shard } from "@siphon/core";
import { parseEther, formatEther } from "viem";
import {
  BOUNTY_BOARD_ABI,
  BOUNTY_BOARD_ADDRESS,
  getWalletClient,
  publicClient,
  idToBytes32,
} from "@/lib/contracts";

interface BountyRecord {
  id: string;
  bounty_id_hex: string;
  poster: string;
  claimant?: string;
  shard_or_swarm_id?: string;
  reward: string;
  description: string;
  deadline: number;
  state: string;
  tx_hash?: string;
  created_at: number;
}

const STATE_BADGES: Record<string, { color: string; icon: React.ReactNode }> = {
  Open: { color: "bg-siphon-teal/10 text-siphon-teal border-siphon-teal/30", icon: <Target className="h-3 w-3" /> },
  Claimed: { color: "bg-deep-violet/10 text-deep-violet border-deep-violet/30", icon: <Clock className="h-3 w-3" /> },
  Completed: { color: "bg-green-500/10 text-green-400 border-green-500/30", icon: <CheckCircle2 className="h-3 w-3" /> },
  Cancelled: { color: "bg-ghost/10 text-ghost border-ghost/30", icon: <XCircle className="h-3 w-3" /> },
  Disputed: { color: "bg-ember/10 text-ember border-ember/30", icon: <AlertTriangle className="h-3 w-3" /> },
};

export default function BountiesPage() {
  const { address } = useAccount();
  const [bounties, setBounties] = useState<BountyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Post bounty form
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("7");
  const [posting, setPosting] = useState(false);

  // Claim state
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimShardId, setClaimShardId] = useState<Record<string, string>>({});
  const [myShards, setMyShards] = useState<Shard[]>([]);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [disputingId, setDisputingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Fetch user's shards for claim picker
  useEffect(() => {
    if (!address) return;
    fetch(`/api/shards?ownerId=${address}`)
      .then((r) => r.json())
      .then((data) => setMyShards(data))
      .catch(() => {});
  }, [address]);

  useEffect(() => {
    fetch("/api/bounties")
      .then((r) => r.json())
      .then((data) => {
        setBounties(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handlePostBounty = async () => {
    if (!address || !description || !reward) return;

    setPosting(true);
    try {
      const walletClient = getWalletClient();
      if (!walletClient) throw new Error("No wallet");

      const bountyId = crypto.randomUUID();
      const bountyIdHex = idToBytes32(bountyId);
      const deadlineTimestamp = Math.floor(
        Date.now() / 1000 + parseInt(deadlineDays) * 86400
      );
      const rewardWei = parseEther(reward);

      const hash = await walletClient.writeContract({
        address: BOUNTY_BOARD_ADDRESS as `0x${string}`,
        abi: BOUNTY_BOARD_ABI,
        functionName: "postBounty",
        args: [bountyIdHex, description, BigInt(deadlineTimestamp)],
        value: rewardWei,
        account: address,
      });

      await publicClient.waitForTransactionReceipt({ hash });

      // Record in API
      const res = await fetch("/api/bounties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poster: address,
          reward,
          description,
          deadline: deadlineTimestamp * 1000,
          txHash: hash,
          bountyIdHex,
        }),
      });

      if (res.ok) {
        const newBounty = await res.json();
        setBounties((prev) => [newBounty, ...prev]);
        setDescription("");
        setReward("");
      }
    } catch (error) {
      console.error("Post bounty error:", error);
    } finally {
      setPosting(false);
    }
  };

  const handleClaimBounty = async (bounty: BountyRecord, shardOrSwarmId: string) => {
    if (!address) return;

    setClaimingId(bounty.id);
    try {
      const walletClient = getWalletClient();
      if (!walletClient) throw new Error("No wallet");

      const hash = await walletClient.writeContract({
        address: BOUNTY_BOARD_ADDRESS as `0x${string}`,
        abi: BOUNTY_BOARD_ABI,
        functionName: "claimBounty",
        args: [
          bounty.bounty_id_hex as `0x${string}`,
          idToBytes32(shardOrSwarmId),
        ],
        account: address,
      });

      await publicClient.waitForTransactionReceipt({ hash });

      // Persist claim to DB
      await fetch("/api/bounties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bountyId: bounty.id,
          action: "claim",
          caller: address,
          shardOrSwarmId,
        }),
      });

      setBounties((prev) =>
        prev.map((b) =>
          b.id === bounty.id
            ? { ...b, state: "Claimed", claimant: address }
            : b
        )
      );
    } catch (error) {
      console.error("Claim bounty error:", error);
    } finally {
      setClaimingId(null);
    }
  };

  const handleCompleteBounty = async (bounty: BountyRecord) => {
    if (!address) return;

    setCompletingId(bounty.id);
    try {
      const walletClient = getWalletClient();
      if (!walletClient) throw new Error("No wallet");

      const hash = await walletClient.writeContract({
        address: BOUNTY_BOARD_ADDRESS as `0x${string}`,
        abi: BOUNTY_BOARD_ABI,
        functionName: "completeBounty",
        args: [bounty.bounty_id_hex as `0x${string}`],
        account: address,
      });

      await publicClient.waitForTransactionReceipt({ hash });

      // Update DB
      await fetch("/api/bounties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bountyId: bounty.id, action: "complete", caller: address }),
      });

      setBounties((prev) =>
        prev.map((b) =>
          b.id === bounty.id ? { ...b, state: "Completed" } : b
        )
      );
    } catch (error) {
      console.error("Complete bounty error:", error);
    } finally {
      setCompletingId(null);
    }
  };

  const handleDisputeBounty = async (bounty: BountyRecord) => {
    if (!address) return;

    setDisputingId(bounty.id);
    try {
      const walletClient = getWalletClient();
      if (!walletClient) throw new Error("No wallet");

      const hash = await walletClient.writeContract({
        address: BOUNTY_BOARD_ADDRESS as `0x${string}`,
        abi: BOUNTY_BOARD_ABI,
        functionName: "disputeBounty",
        args: [bounty.bounty_id_hex as `0x${string}`],
        account: address,
      });

      await publicClient.waitForTransactionReceipt({ hash });

      // Update DB
      await fetch("/api/bounties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bountyId: bounty.id, action: "dispute", caller: address }),
      });

      setBounties((prev) =>
        prev.map((b) =>
          b.id === bounty.id ? { ...b, state: "Disputed" } : b
        )
      );
    } catch (error) {
      console.error("Dispute bounty error:", error);
    } finally {
      setDisputingId(null);
    }
  };

  const handleCancelBounty = async (bounty: BountyRecord) => {
    if (!address) return;

    setCancellingId(bounty.id);
    try {
      const walletClient = getWalletClient();
      if (!walletClient) throw new Error("No wallet");

      const hash = await walletClient.writeContract({
        address: BOUNTY_BOARD_ADDRESS as `0x${string}`,
        abi: BOUNTY_BOARD_ABI,
        functionName: "cancelBounty",
        args: [bounty.bounty_id_hex as `0x${string}`],
        account: address,
      });

      await publicClient.waitForTransactionReceipt({ hash });

      // Persist cancel to DB
      await fetch("/api/bounties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bountyId: bounty.id, action: "cancel", caller: address }),
      });

      setBounties((prev) =>
        prev.map((b) =>
          b.id === bounty.id ? { ...b, state: "Cancelled" } : b
        )
      );
    } catch (error) {
      console.error("Cancel bounty error:", error);
    } finally {
      setCancellingId(null);
    }
  };

  const openBounties = bounties.filter((b) => b.state === "Open");
  const activeBounties = bounties.filter(
    (b) => b.state === "Claimed" || b.state === "Disputed"
  );
  const closedBounties = bounties.filter(
    (b) => b.state === "Completed" || b.state === "Cancelled"
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foam">Bounty Board</h1>
        <p className="text-ghost text-sm mt-1">
          Post tasks with ETH rewards. Agents claim and complete bounties.
        </p>
      </div>

      <Tabs.Root defaultValue="open" className="space-y-4">
        <Tabs.List className="flex border-b border-ghost/10">
          <Tabs.Trigger
            value="open"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ghost transition-colors border-b-2 border-transparent data-[state=active]:text-siphon-teal data-[state=active]:border-siphon-teal hover:text-foam"
          >
            <Target className="h-4 w-4" />
            Open
            {openBounties.length > 0 && (
              <Badge className="ml-1 border-siphon-teal/30 bg-siphon-teal/10 text-siphon-teal">
                {openBounties.length}
              </Badge>
            )}
          </Tabs.Trigger>
          <Tabs.Trigger
            value="active"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ghost transition-colors border-b-2 border-transparent data-[state=active]:text-siphon-teal data-[state=active]:border-siphon-teal hover:text-foam"
          >
            <Clock className="h-4 w-4" />
            In Progress
          </Tabs.Trigger>
          <Tabs.Trigger
            value="post"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ghost transition-colors border-b-2 border-transparent data-[state=active]:text-siphon-teal data-[state=active]:border-siphon-teal hover:text-foam"
          >
            <Plus className="h-4 w-4" />
            Post Bounty
          </Tabs.Trigger>
        </Tabs.List>

        {/* OPEN BOUNTIES */}
        <Tabs.Content value="open" className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-siphon-teal animate-spin" />
            </div>
          ) : openBounties.length === 0 ? (
            <Card className="p-12 text-center">
              <Target className="h-12 w-12 text-ghost/20 mx-auto mb-3" />
              <p className="text-ghost text-sm">No open bounties.</p>
              <p className="text-ghost/50 text-xs mt-1">
                Post a bounty to get started!
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {openBounties.map((bounty) => (
                <Card key={bounty.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foam line-clamp-2">
                        {bounty.description}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-siphon-teal ml-2 shrink-0">
                      {bounty.reward} ETH
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-ghost/50 mb-3">
                    <span>
                      By: {bounty.poster.slice(0, 6)}...
                      {bounty.poster.slice(-4)}
                    </span>
                    <span>
                      Deadline:{" "}
                      {new Date(bounty.deadline).toLocaleDateString()}
                    </span>
                  </div>
                  {address &&
                  address.toLowerCase() !== bounty.poster.toLowerCase() ? (
                    <div className="space-y-2">
                      <select
                        value={claimShardId[bounty.id] || ""}
                        onChange={(e) =>
                          setClaimShardId((prev) => ({
                            ...prev,
                            [bounty.id]: e.target.value,
                          }))
                        }
                        className="flex h-8 w-full rounded-lg border border-siphon-teal/20 bg-abyss px-2 py-1 text-xs text-foam focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-siphon-teal/30"
                      >
                        <option value="" className="bg-abyss text-ghost">
                          Select shard...
                        </option>
                        {myShards.map((s) => (
                          <option
                            key={s.id}
                            value={s.id}
                            className="bg-abyss text-foam"
                          >
                            {s.name} (Lvl {s.level})
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          handleClaimBounty(
                            bounty,
                            claimShardId[bounty.id] || ""
                          )
                        }
                        disabled={
                          claimingId === bounty.id ||
                          !claimShardId[bounty.id]
                        }
                      >
                        {claimingId === bounty.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Claim Bounty"
                        )}
                      </Button>
                    </div>
                  ) : address &&
                    address.toLowerCase() ===
                      bounty.poster.toLowerCase() ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleCancelBounty(bounty)}
                      disabled={cancellingId === bounty.id}
                    >
                      {cancellingId === bounty.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Cancel"
                      )}
                    </Button>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </Tabs.Content>

        {/* IN PROGRESS */}
        <Tabs.Content value="active" className="space-y-3">
          {activeBounties.length === 0 ? (
            <Card className="p-12 text-center">
              <Clock className="h-12 w-12 text-ghost/20 mx-auto mb-3" />
              <p className="text-ghost text-sm">
                No bounties in progress.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeBounties.map((bounty) => {
                const badge = STATE_BADGES[bounty.state] || STATE_BADGES.Open;
                return (
                  <Card key={bounty.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm text-foam flex-1 min-w-0 line-clamp-2">
                        {bounty.description}
                      </p>
                      <Badge
                        className={`ml-2 shrink-0 ${badge.color}`}
                      >
                        {badge.icon}
                        <span className="ml-1">{bounty.state}</span>
                      </Badge>
                    </div>
                    <div className="text-[10px] text-ghost/50 mb-3">
                      <p>Reward: {bounty.reward} ETH</p>
                      {bounty.claimant && (
                        <p>
                          Claimant: {bounty.claimant.slice(0, 6)}...
                          {bounty.claimant.slice(-4)}
                        </p>
                      )}
                    </div>
                    {address && bounty.state === "Claimed" && (
                      <div className="flex gap-2">
                        {address.toLowerCase() === bounty.poster.toLowerCase() && (
                          <>
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => handleCompleteBounty(bounty)}
                              disabled={completingId === bounty.id}
                            >
                              {completingId === bounty.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Approve"
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleDisputeBounty(bounty)}
                              disabled={disputingId === bounty.id}
                            >
                              {disputingId === bounty.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Dispute"
                              )}
                            </Button>
                          </>
                        )}
                        {bounty.claimant &&
                          address.toLowerCase() === bounty.claimant.toLowerCase() && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleDisputeBounty(bounty)}
                              disabled={disputingId === bounty.id}
                            >
                              {disputingId === bounty.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Dispute"
                              )}
                            </Button>
                          )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </Tabs.Content>

        {/* POST BOUNTY */}
        <Tabs.Content value="post" className="space-y-4">
          {!address ? (
            <Card className="p-8 text-center">
              <Target className="h-12 w-12 text-ghost/20 mx-auto mb-3" />
              <p className="text-ghost text-sm">
                Connect your wallet to post bounties.
              </p>
            </Card>
          ) : (
            <Card className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-foam">
                Post a New Bounty
              </h3>
              <div>
                <label className="text-sm font-medium text-foam block mb-2">
                  Task Description
                </label>
                <textarea
                  className="flex w-full rounded-lg border border-siphon-teal/20 bg-abyss px-3 py-2 text-sm text-foam focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-siphon-teal/30 transition-colors min-h-[100px] resize-y"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the task your agent should complete..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foam block mb-2">
                    Reward (ETH)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.001"
                    value={reward}
                    onChange={(e) => setReward(e.target.value)}
                    placeholder="0.05"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foam block mb-2">
                    Deadline (days)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={deadlineDays}
                    onChange={(e) => setDeadlineDays(e.target.value)}
                    placeholder="7"
                  />
                </div>
              </div>
              <Button
                onClick={handlePostBounty}
                disabled={!description || !reward || posting}
                className="w-full"
                size="lg"
              >
                {posting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Coins className="h-4 w-4 mr-2" />
                    Post Bounty ({reward || "0"} ETH)
                  </>
                )}
              </Button>
              <p className="text-[10px] text-ghost/50 text-center">
                ETH is escrowed on-chain. Refunded if you cancel before
                someone claims.
              </p>
            </Card>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
