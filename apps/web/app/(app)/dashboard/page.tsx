"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import type { Shard } from "@siphon/core";
import { ShardCard } from "@/components/shard-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Compass, Wallet, Waves, Target, BriefcaseBusiness } from "lucide-react";
import Link from "next/link";

type FunnelStep = {
  step: "captured" | "trained" | "battled" | "claimed_bounty" | "completed_bounty";
  users: number;
  firstAt: number | null;
  conversionFromPrevious: number | null;
  conversionFromStart: number | null;
};

type FunnelResponse = {
  scope: "me" | "global";
  ownerId: string | null;
  windowDays: number;
  funnel: {
    totals: {
      uniqueUsers: number;
      events: number;
    };
    steps: FunnelStep[];
  };
};

const FUNNEL_LABELS: Record<FunnelStep["step"], string> = {
  captured: "Captured",
  trained: "Trained",
  battled: "Battled",
  claimed_bounty: "Claimed Bounty",
  completed_bounty: "Completed Bounty",
};

const NEXT_ACTION: Record<
  FunnelStep["step"] | "start",
  { title: string; href: string; cta: string; detail: string }
> = {
  start: {
    title: "Start qualification",
    href: "/drift",
    cta: "Capture first shard",
    detail: "No activation events yet. Capture a shard to enter the funnel.",
  },
  captured: {
    title: "Train for task readiness",
    href: "/dashboard",
    cta: "Train your shard",
    detail: "You captured shards but haven't recorded training activation.",
  },
  trained: {
    title: "Pressure-test capability",
    href: "/battle",
    cta: "Enter battle",
    detail: "Battle data improves confidence before real task claims.",
  },
  battled: {
    title: "Convert skill to revenue",
    href: "/bounties",
    cta: "Claim a live bounty",
    detail: "You have proven capability but no bounty claim yet.",
  },
  claimed_bounty: {
    title: "Close the loop",
    href: "/bounties",
    cta: "Complete claimed bounty",
    detail: "Your next leverage point is accepted outcomes.",
  },
  completed_bounty: {
    title: "Scale outcomes",
    href: "/bounties",
    cta: "Take next bounty",
    detail: "You’re activated. Focus on throughput and quality.",
  },
};

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [shards, setShards] = useState<Shard[]>([]);
  const [loading, setLoading] = useState(true);
  const [battlesWon, setBattlesWon] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [outcomesDelivered, setOutcomesDelivered] = useState(0);
  const [outcomesPosted, setOutcomesPosted] = useState(0);
  const [outcomeEarningsEth, setOutcomeEarningsEth] = useState(0);
  const [funnelLoading, setFunnelLoading] = useState(false);
  const [funnelError, setFunnelError] = useState<string | null>(null);
  const [funnelSteps, setFunnelSteps] = useState<FunnelStep[]>([]);

  useEffect(() => {
    const ownerId = address || "anonymous";
    fetch(`/api/shards?ownerId=${ownerId}`)
      .then((r) => r.json())
      .then((data) => {
        setShards(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load shards");
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
        .catch(() => {
          setError("Failed to load battle stats");
        });
    }
  }, [address]);

  const nextAction = useMemo(() => {
    if (funnelSteps.length === 0) return NEXT_ACTION.start;
    const order: FunnelStep["step"][] = [
      "captured",
      "trained",
      "battled",
      "claimed_bounty",
      "completed_bounty",
    ];
    for (const step of order) {
      const row = funnelSteps.find((s) => s.step === step);
      if (!row || row.users <= 0) return NEXT_ACTION[step];
    }
    return NEXT_ACTION.completed_bounty;
  }, [funnelSteps]);

  useEffect(() => {
    if (!address) return;
    fetch("/api/bounties")
      .then((r) => r.json())
      .then((rows: any[]) => {
        const me = address.toLowerCase();
        const delivered = rows.filter(
          (b) => b.state === "Completed" && b.claimant?.toLowerCase() === me
        );
        const posted = rows.filter(
          (b) => b.poster?.toLowerCase() === me
        );
        const earnings = delivered.reduce(
          (sum, b) => sum + Number.parseFloat(String(b.reward || "0")),
          0
        );
        setOutcomesDelivered(delivered.length);
        setOutcomesPosted(posted.length);
        setOutcomeEarningsEth(Number.isFinite(earnings) ? earnings : 0);
      })
      .catch(() => {});
  }, [address]);

  useEffect(() => {
    if (!address) {
      setFunnelSteps([]);
      setFunnelError(null);
      return;
    }
    setFunnelLoading(true);
    setFunnelError(null);
    fetch("/api/analytics/funnel?scope=me&days=30")
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.error || "Failed to load funnel data");
        }
        return r.json() as Promise<FunnelResponse>;
      })
      .then((data) => {
        setFunnelSteps(data.funnel.steps ?? []);
      })
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : "Failed to load funnel data";
        setFunnelError(message);
      })
      .finally(() => setFunnelLoading(false));
  }, [address]);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center py-8 space-y-4">
        <h1 className="text-4xl font-bold text-foam tracking-tight">
          <span className="text-siphon-teal glow-text">Siphon</span> Protocol
        </h1>
        <p className="text-ghost max-w-lg mx-auto">
          Capture and train shards, then route them into real bounties with on-chain rewards.
        </p>
        {!isConnected && (
          <p className="text-xs text-deep-violet">
            Connect your wallet for on-chain ownership
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-ghost font-normal">
              Outcomes Delivered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-ember font-mono">{outcomesDelivered}</div>
            <p className="text-xs text-ghost mt-1">Completed bounties</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-ghost font-normal">
              Outcome Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-siphon-teal font-mono">
              {outcomeEarningsEth.toFixed(3)}
            </div>
            <p className="text-xs text-ghost mt-1">ETH from completed bounties</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-siphon-teal/35 bg-[#071123]/90">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-siphon-teal">Value Loop</p>
              <p className="mt-1 text-foam">
                Game actions are qualification. Real value is delivered on the bounty board.
              </p>
              <p className="mt-1 text-xs text-ghost">
                You&apos;ve posted {outcomesPosted} bounties and delivered {outcomesDelivered} outcomes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/bounties">
                <Button>
                  <Target className="h-4 w-4 mr-2" />
                  Claim Live Bounty
                </Button>
              </Link>
              <Link href="/bounties">
                <Button variant="outline">
                  <BriefcaseBusiness className="h-4 w-4 mr-2" />
                  Post Task
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-300/35 bg-amber-500/10">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-amber-200">{nextAction.title}</p>
            <p className="mt-1 text-foam">{nextAction.detail}</p>
          </div>
          <Link href={nextAction.href}>
            <Button size="sm">
              <Target className="h-4 w-4 mr-2" />
              {nextAction.cta}
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card className="border-siphon-teal/35 bg-[#071123]/90">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-foam font-normal">
            Personal Activation Funnel (30d)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!address ? (
            <p className="text-sm text-ghost">
              Connect wallet to view your funnel conversion.
            </p>
          ) : funnelLoading ? (
            <p className="text-sm text-ghost animate-pulse">Loading funnel...</p>
          ) : funnelError ? (
            <p className="text-sm text-red-300">{funnelError}</p>
          ) : (
            <>
              {funnelSteps.map((step) => {
                const fromPrev =
                  step.conversionFromPrevious === null
                    ? null
                    : Math.round(step.conversionFromPrevious * 100);
                const fromStart =
                  step.conversionFromStart === null
                    ? null
                    : Math.round(step.conversionFromStart * 100);
                const widthPct = Math.max(
                  6,
                  Math.min(100, fromStart ?? (step.users > 0 ? 100 : 6))
                );
                return (
                  <div key={step.step} className="border border-siphon-teal/15 bg-abyss/45 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-wide text-ghost">
                        {FUNNEL_LABELS[step.step]}
                      </p>
                      <p className="font-mono text-sm text-foam">{step.users}</p>
                    </div>
                    <div className="mt-2 h-2 w-full border border-siphon-teal/20 bg-abyss">
                      <div
                        className="h-full bg-siphon-teal/70"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-ghost/70">
                      <span>
                        Prev: {fromPrev === null ? "-" : `${fromPrev}%`}
                      </span>
                      <span>
                        Start: {fromStart === null ? "-" : `${fromStart}%`}
                      </span>
                    </div>
                  </div>
                );
              })}
              {funnelSteps.length === 0 && (
                <p className="text-sm text-ghost">
                  No funnel events yet. Capture a shard to start.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex gap-4">
        <Link href="/drift">
          <Button size="lg">
            <Compass className="h-5 w-5 mr-2" />
            Explore the Drift
          </Button>
        </Link>
        <Link href="/bounties">
          <Button size="lg" variant="outline">
            <Target className="h-5 w-5 mr-2" />
            Take Real Task
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-4 space-y-3">
                <div className="h-5 w-1/2 bg-ghost/20 rounded animate-pulse" />
                <div className="h-4 w-1/3 bg-ghost/20 rounded animate-pulse" />
                <div className="h-20 w-full bg-ghost/10 rounded animate-pulse" />
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="p-6 text-center">
            <p className="text-red-300 text-sm">{error}</p>
          </Card>
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
