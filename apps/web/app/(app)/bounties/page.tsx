"use client";

import { useState, useEffect, useCallback } from "react";
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
  ShieldCheck,
  WandSparkles,
} from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import type { Shard } from "@siphon/core";
import { parseEther } from "viem";
import {
  BOUNTY_BOARD_ABI,
  BOUNTY_BOARD_ADDRESS,
  getWalletClient,
  publicClient,
  idToBytes32,
} from "@/lib/contracts";
import { toast } from "sonner";
import { updateOnboardingProgress } from "@/lib/game-feedback";
import { useSmartWrite } from "@/hooks/use-smart-write";

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
  execution_status?: string;
  execution_result?: string;
  tx_hash?: string;
  created_at: number;
}

interface RecommendationRow {
  bountyId: string;
  reward: string;
  deadline: number;
  bestMatch: {
    shardId: string;
    shardName: string;
    score: number;
    reasons: string[];
  } | null;
  alternatives: Array<{
    shardId: string;
    shardName: string;
    score: number;
    reasons: string[];
  }>;
}

interface ReputationRow {
  address: string;
  completionRate: number;
  disputeRate: number;
  trustScore: number;
  earningsEth: number;
  completedAsClaimant: number;
}

interface QualityRow {
  overall: number;
  verdict: "excellent" | "good" | "needs_work";
  dimensions: {
    completeness: number;
    specificity: number;
    actionability: number;
    clarity: number;
  };
  strengths: string[];
  risks: string[];
  summary: string;
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
  const { smartWrite, isSmartWallet } = useSmartWrite();
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
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Record<string, RecommendationRow>>({});
  const [reputationByAddress, setReputationByAddress] = useState<Record<string, ReputationRow>>({});
  const [qualityByBountyId, setQualityByBountyId] = useState<Record<string, QualityRow>>({});
  const [qualityLoadingId, setQualityLoadingId] = useState<string | null>(null);

  // Fetch user's shards for claim picker
  useEffect(() => {
    if (!address) return;
    fetch(`/api/shards?ownerId=${address}`)
      .then((r) => r.json())
      .then((data) => setMyShards(data))
      .catch(() => {});
  }, [address]);

  const fetchBounties = useCallback(() => {
    fetch("/api/bounties")
      .then((r) => r.json())
      .then((data) => {
        setBounties(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchBounties();
  }, [fetchBounties]);

  useEffect(() => {
    if (!address) {
      setRecommendations({});
      return;
    }
    fetch("/api/bounties/recommendations")
      .then((r) => r.json())
      .then((rows: RecommendationRow[]) => {
        const next: Record<string, RecommendationRow> = {};
        for (const row of rows) next[row.bountyId] = row;
        setRecommendations(next);
      })
      .catch(() => {});
  }, [address, bounties.length]);

  useEffect(() => {
    if (!address || bounties.length === 0) {
      setReputationByAddress({});
      return;
    }
    const addresses = Array.from(
      new Set(
        bounties
          .flatMap((b) => [b.poster, b.claimant].filter(Boolean))
          .map((a) => String(a).toLowerCase())
      )
    );
    fetch("/api/operators/reputation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses }),
    })
      .then((r) => r.json())
      .then((rows: ReputationRow[]) => {
        const map: Record<string, ReputationRow> = {};
        for (const row of rows) map[row.address.toLowerCase()] = row;
        setReputationByAddress(map);
      })
      .catch(() => {});
  }, [address, bounties]);

  const shortAddress = (value?: string) =>
    value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "-";

  const getReputation = (value?: string) =>
    value ? reputationByAddress[value.toLowerCase()] : undefined;

  const loadQuality = async (bountyId: string) => {
    setQualityLoadingId(bountyId);
    try {
      const res = await fetch(`/api/bounties/${bountyId}/quality`);
      if (!res.ok) throw new Error("Failed quality analysis");
      const data = await res.json();
      setQualityByBountyId((prev) => ({ ...prev, [bountyId]: data.quality as QualityRow }));
    } catch {
      toast.error("Failed to analyze output quality");
    } finally {
      setQualityLoadingId(null);
    }
  };

  const handlePostBounty = async () => {
    if (!address || !description || !reward) return;

    setPosting(true);
    try {
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("No wallet");

      const bountyId = crypto.randomUUID();
      const bountyIdHex = idToBytes32(bountyId);
      const deadlineTimestamp = Math.floor(
        Date.now() / 1000 + parseInt(deadlineDays) * 86400
      );
      const rewardWei = parseEther(reward);

      let hash: string;
      if (isSmartWallet) {
        const batchId = await smartWrite([
          {
            address: BOUNTY_BOARD_ADDRESS as `0x${string}`,
            abi: BOUNTY_BOARD_ABI,
            functionName: "postBounty",
            args: [bountyIdHex, description, BigInt(deadlineTimestamp)],
            value: rewardWei,
          },
        ]);
        if (!batchId) throw new Error("Smart wallet post failed");
        hash = String(batchId);
      } else {
        hash = await walletClient.writeContract({
          address: BOUNTY_BOARD_ADDRESS as `0x${string}`,
          abi: BOUNTY_BOARD_ABI,
          functionName: "postBounty",
          args: [bountyIdHex, description, BigInt(deadlineTimestamp)],
          value: rewardWei,
          account: address,
        });
        await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      }

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
        toast.success("Bounty posted!");
        updateOnboardingProgress(address, { outcomeActivated: true });
        fetchBounties();
      }
    } catch (error) {
      toast.error("Failed to post bounty");
      console.error("Post bounty error:", error);
    } finally {
      setPosting(false);
    }
  };

  const handleClaimBounty = async (bounty: BountyRecord, shardOrSwarmId: string) => {
    if (!address) return;

    setClaimingId(bounty.id);
    try {
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("No wallet");

      if (isSmartWallet) {
        const batchId = await smartWrite([
          {
            address: BOUNTY_BOARD_ADDRESS as `0x${string}`,
            abi: BOUNTY_BOARD_ABI,
            functionName: "claimBounty",
            args: [bounty.bounty_id_hex as `0x${string}`, idToBytes32(shardOrSwarmId)],
          },
        ]);
        if (!batchId) throw new Error("Smart wallet claim failed");
      } else {
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
      }

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

      toast.success("Bounty claimed!");
      updateOnboardingProgress(address, { outcomeActivated: true });
      fetchBounties();
    } catch (error) {
      toast.error("Failed to claim bounty");
      console.error("Claim bounty error:", error);
    } finally {
      setClaimingId(null);
    }
  };

  const handleCompleteBounty = async (bounty: BountyRecord) => {
    if (!address) return;

    setCompletingId(bounty.id);
    try {
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("No wallet");

      if (isSmartWallet) {
        const batchId = await smartWrite([
          {
            address: BOUNTY_BOARD_ADDRESS as `0x${string}`,
            abi: BOUNTY_BOARD_ABI,
            functionName: "completeBounty",
            args: [bounty.bounty_id_hex as `0x${string}`],
          },
        ]);
        if (!batchId) throw new Error("Smart wallet complete failed");
      } else {
        const hash = await walletClient.writeContract({
          address: BOUNTY_BOARD_ADDRESS as `0x${string}`,
          abi: BOUNTY_BOARD_ABI,
          functionName: "completeBounty",
          args: [bounty.bounty_id_hex as `0x${string}`],
          account: address,
        });
        await publicClient.waitForTransactionReceipt({ hash });
      }

      // Update DB
      await fetch("/api/bounties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bountyId: bounty.id, action: "complete", caller: address }),
      });

      toast.success("Bounty approved!");
      updateOnboardingProgress(address, { outcomeActivated: true });
      fetchBounties();
    } catch (error) {
      toast.error("Failed to complete bounty");
      console.error("Complete bounty error:", error);
    } finally {
      setCompletingId(null);
    }
  };

  const handleDisputeBounty = async (bounty: BountyRecord) => {
    if (!address) return;

    setDisputingId(bounty.id);
    try {
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("No wallet");

      if (isSmartWallet) {
        const batchId = await smartWrite([
          {
            address: BOUNTY_BOARD_ADDRESS as `0x${string}`,
            abi: BOUNTY_BOARD_ABI,
            functionName: "disputeBounty",
            args: [bounty.bounty_id_hex as `0x${string}`],
          },
        ]);
        if (!batchId) throw new Error("Smart wallet dispute failed");
      } else {
        const hash = await walletClient.writeContract({
          address: BOUNTY_BOARD_ADDRESS as `0x${string}`,
          abi: BOUNTY_BOARD_ABI,
          functionName: "disputeBounty",
          args: [bounty.bounty_id_hex as `0x${string}`],
          account: address,
        });
        await publicClient.waitForTransactionReceipt({ hash });
      }

      // Update DB
      await fetch("/api/bounties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bountyId: bounty.id, action: "dispute", caller: address }),
      });

      toast.success("Bounty disputed");
      fetchBounties();
    } catch (error) {
      toast.error("Failed to dispute bounty");
      console.error("Dispute bounty error:", error);
    } finally {
      setDisputingId(null);
    }
  };

  const handleCancelBounty = async (bounty: BountyRecord) => {
    if (!address) return;

    setCancellingId(bounty.id);
    try {
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("No wallet");

      if (isSmartWallet) {
        const batchId = await smartWrite([
          {
            address: BOUNTY_BOARD_ADDRESS as `0x${string}`,
            abi: BOUNTY_BOARD_ABI,
            functionName: "cancelBounty",
            args: [bounty.bounty_id_hex as `0x${string}`],
          },
        ]);
        if (!batchId) throw new Error("Smart wallet cancel failed");
      } else {
        const hash = await walletClient.writeContract({
          address: BOUNTY_BOARD_ADDRESS as `0x${string}`,
          abi: BOUNTY_BOARD_ABI,
          functionName: "cancelBounty",
          args: [bounty.bounty_id_hex as `0x${string}`],
          account: address,
        });
        await publicClient.waitForTransactionReceipt({ hash });
      }

      // Persist cancel to DB
      await fetch("/api/bounties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bountyId: bounty.id, action: "cancel", caller: address }),
      });

      toast.success("Bounty cancelled");
      fetchBounties();
    } catch (error) {
      toast.error("Failed to cancel bounty");
      console.error("Cancel bounty error:", error);
    } finally {
      setCancellingId(null);
    }
  };

  const handleResolveDispute = async (bounty: BountyRecord, outcome: "resolve_complete" | "resolve_cancel") => {
    if (!address) return;
    setResolvingId(bounty.id);
    try {
      const res = await fetch("/api/bounties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bountyId: bounty.id, action: outcome }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(outcome === "resolve_complete" ? "Dispute resolved: completed" : "Dispute resolved: cancelled");
      fetchBounties();
    } catch {
      toast.error("Failed to resolve dispute");
    } finally {
      setResolvingId(null);
    }
  };

  const openBounties = bounties.filter((b) => b.state === "Open");
  const activeBounties = bounties.filter(
    (b) => b.state === "Claimed" || b.state === "Disputed"
  );
  const closedBounties = bounties.filter(
    (b) => b.state === "Completed" || b.state === "Cancelled"
  );
  const openRewardPoolEth = openBounties.reduce(
    (sum, b) => sum + Number.parseFloat(String(b.reward || "0")),
    0
  );
  const myActiveOutcomeCount = address
    ? activeBounties.filter(
        (b) =>
          b.claimant?.toLowerCase() === address.toLowerCase() ||
          b.poster.toLowerCase() === address.toLowerCase()
      ).length
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="pixel-title text-[14px] text-foam">Bounty Board</h1>
        <p className="text-ghost mt-2">
          This is the real-value layer: game-trained shards execute paid work with on-chain escrow.
        </p>
      </div>

      <Card className="border-siphon-teal/30 bg-[#071123]/90 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border border-siphon-teal/15 bg-abyss/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-ghost/70">Open Tasks</p>
            <p className="text-xl font-mono text-foam">{openBounties.length}</p>
          </div>
          <div className="border border-siphon-teal/15 bg-abyss/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-ghost/70">Escrow Pool</p>
            <p className="text-xl font-mono text-siphon-teal">{openRewardPoolEth.toFixed(3)} ETH</p>
          </div>
          <div className="border border-siphon-teal/15 bg-abyss/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-ghost/70">In Progress</p>
            <p className="text-xl font-mono text-foam">{activeBounties.length}</p>
          </div>
          <div className="border border-siphon-teal/15 bg-abyss/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-ghost/70">Your Active</p>
            <p className="text-xl font-mono text-amber-300">{myActiveOutcomeCount}</p>
          </div>
        </div>
      </Card>

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
                  {(() => {
                    const rep = getReputation(bounty.poster);
                    const rec = recommendations[bounty.id];
                    return (
                      <>
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
                      By: {shortAddress(bounty.poster)}
                    </span>
                    <span>
                      Deadline:{" "}
                      {new Date(bounty.deadline).toLocaleDateString()}
                    </span>
                    {rep && (
                      <span className="text-siphon-teal/80">
                        Trust {rep.trustScore}
                      </span>
                    )}
                  </div>
                  {rec?.bestMatch && (
                    <div className="mb-3 border border-siphon-teal/20 bg-abyss/50 p-2 text-xs">
                      <p className="text-siphon-teal">
                        Best match: {rec.bestMatch.shardName} (fit {rec.bestMatch.score})
                      </p>
                      <p className="text-ghost/70 mt-1">
                        {rec.bestMatch.reasons.join(" · ")}
                      </p>
                    </div>
                  )}
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
                      {rec?.bestMatch && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => handleClaimBounty(bounty, rec.bestMatch!.shardId)}
                          disabled={claimingId === bounty.id}
                        >
                          <WandSparkles className="h-4 w-4 mr-2" />
                          Claim With Best Match
                        </Button>
                      )}
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
                      </>
                    );
                  })()}
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
                const claimantRep = getReputation(bounty.claimant);
                const quality = qualityByBountyId[bounty.id];
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
                          Claimant: {shortAddress(bounty.claimant)}
                          {claimantRep ? ` · Trust ${claimantRep.trustScore}` : ""}
                        </p>
                      )}
                      {bounty.execution_status && (
                        <p>Execution: {bounty.execution_status}</p>
                      )}
                    </div>
                    {bounty.execution_result && (
                      <div className="mb-3 rounded border border-siphon-teal/10 bg-abyss/60 p-2">
                        <p className="text-[10px] text-ghost/70 mb-1">Shard output</p>
                        <p className="text-xs text-foam/80 line-clamp-4">{bounty.execution_result}</p>
                      </div>
                    )}
                    {bounty.execution_result && (
                      <div className="mb-3 border border-siphon-teal/20 bg-abyss/50 p-2">
                        {quality ? (
                          <>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-siphon-teal inline-flex items-center gap-1">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Quality {quality.overall} ({quality.verdict})
                              </span>
                              <span className="text-ghost/70">
                                Clarity {quality.dimensions.clarity} · Action {quality.dimensions.actionability}
                              </span>
                            </div>
                            <p className="text-[11px] text-ghost mt-1">{quality.summary}</p>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => loadQuality(bounty.id)}
                            disabled={qualityLoadingId === bounty.id}
                          >
                            {qualityLoadingId === bounty.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Analyze Output Quality
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    )}
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
                    {address &&
                      bounty.state === "Disputed" &&
                      address.toLowerCase() === bounty.poster.toLowerCase() && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => handleResolveDispute(bounty, "resolve_complete")}
                            disabled={resolvingId === bounty.id}
                          >
                            {resolvingId === bounty.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Resolve: Complete"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleResolveDispute(bounty, "resolve_cancel")}
                            disabled={resolvingId === bounty.id}
                          >
                            {resolvingId === bounty.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Resolve: Cancel"
                            )}
                          </Button>
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
