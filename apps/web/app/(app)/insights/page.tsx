"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, RefreshCw, ShieldAlert, TrendingUp, TrendingDown } from "lucide-react";

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
  windowEndMs: number;
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

const WINDOW_OPTIONS = [7, 14, 30, 60, 90];

function percent(value: number | null): string {
  if (value === null) return "-";
  return `${Math.round(value * 100)}%`;
}

export default function InsightsPage() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<FunnelResponse | null>(null);
  const [previous, setPrevious] = useState<FunnelResponse | null>(null);

  const load = async (windowDays: number) => {
    setLoading(true);
    setError(null);
    const now = Date.now();
    const prevEnd = now - windowDays * 24 * 60 * 60 * 1000;
    try {
      const [currentRes, previousRes] = await Promise.all([
        fetch(`/api/analytics/funnel?scope=global&days=${windowDays}&endMs=${now}`),
        fetch(`/api/analytics/funnel?scope=global&days=${windowDays}&endMs=${prevEnd}`),
      ]);

      if (!currentRes.ok) {
        const body = await currentRes.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to load insights");
      }
      if (!previousRes.ok) {
        const body = await previousRes.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to load previous cohort");
      }

      const currentData = (await currentRes.json()) as FunnelResponse;
      const previousData = (await previousRes.json()) as FunnelResponse;
      setCurrent(currentData);
      setPrevious(previousData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load insights";
      setError(message);
      setCurrent(null);
      setPrevious(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(days);
  }, [days]);

  const comparison = useMemo(() => {
    if (!current || !previous) return [] as Array<{
      step: FunnelStep["step"];
      currentUsers: number;
      previousUsers: number;
      usersDelta: number;
      currentConv: number | null;
      previousConv: number | null;
      convDelta: number | null;
    }>;

    return current.funnel.steps.map((step, idx) => {
      const prevStep = previous.funnel.steps[idx];
      const convDelta =
        step.conversionFromStart === null || prevStep?.conversionFromStart === null
          ? null
          : step.conversionFromStart - prevStep.conversionFromStart;

      return {
        step: step.step,
        currentUsers: step.users,
        previousUsers: prevStep?.users ?? 0,
        usersDelta: step.users - (prevStep?.users ?? 0),
        currentConv: step.conversionFromStart,
        previousConv: prevStep?.conversionFromStart ?? null,
        convDelta,
      };
    });
  }, [current, previous]);

  if (error?.toLowerCase().includes("admin allowlist") || error?.toLowerCase().includes("forbidden")) {
    return (
      <div className="space-y-6">
        <h1 className="pixel-title text-[14px] text-foam">Insights</h1>
        <Card className="border-red-400/35 bg-red-950/20">
          <CardContent className="p-6 text-center space-y-3">
            <ShieldAlert className="h-10 w-10 text-red-300 mx-auto" />
            <p className="text-red-200">Admin access required for global analytics.</p>
            <p className="text-xs text-red-200/80">
              Add your wallet to <code>ANALYTICS_ADMIN_ADDRESSES</code> to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="pixel-title text-[14px] text-foam">Insights</h1>
          <p className="text-ghost mt-2">Global activation funnel and cohort comparison.</p>
        </div>
        <div className="flex items-center gap-2">
          {WINDOW_OPTIONS.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? "default" : "outline"}
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => void load(days)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-ghost">Current Cohort</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-mono text-foam">{current?.funnel.totals.uniqueUsers ?? 0}</p>
            <p className="text-xs text-ghost mt-1">Unique users ({days}d)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-ghost">Previous Cohort</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-mono text-foam">{previous?.funnel.totals.uniqueUsers ?? 0}</p>
            <p className="text-xs text-ghost mt-1">Prior {days}d window</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-ghost">Completed Conversion</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-mono text-siphon-teal">
              {percent(current?.funnel.steps[4]?.conversionFromStart ?? null)}
            </p>
            <p className="text-xs text-ghost mt-1">Captured {"->"} Completed Bounty</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-siphon-teal/30 bg-[#071123]/90">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-normal text-foam flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Funnel Step Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-ghost animate-pulse">Loading insights...</p>
          ) : error ? (
            <p className="text-sm text-red-300">{error}</p>
          ) : (
            comparison.map((row) => {
              const barBase = Math.max(row.currentUsers, row.previousUsers, 1);
              const currentWidth = `${Math.max(6, (row.currentUsers / barBase) * 100)}%`;
              const prevWidth = `${Math.max(6, (row.previousUsers / barBase) * 100)}%`;
              const convDeltaPct = row.convDelta === null ? null : Math.round(row.convDelta * 100);
              return (
                <div key={row.step} className="border border-siphon-teal/15 bg-abyss/45 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-wide text-ghost">{FUNNEL_LABELS[row.step]}</p>
                    <div className="flex items-center gap-3 text-[11px] font-mono">
                      <span className="text-siphon-teal">Now {row.currentUsers}</span>
                      <span className="text-ghost/70">Prev {row.previousUsers}</span>
                    </div>
                  </div>

                  <div className="mt-2 space-y-1">
                    <div className="h-2 w-full border border-siphon-teal/20 bg-abyss">
                      <div className="h-full bg-siphon-teal/70" style={{ width: currentWidth }} />
                    </div>
                    <div className="h-2 w-full border border-ghost/20 bg-abyss">
                      <div className="h-full bg-ghost/45" style={{ width: prevWidth }} />
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-ghost/70">
                    <span>
                      Start conv: {percent(row.currentConv)} (prev {percent(row.previousConv)})
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {row.usersDelta >= 0 ? (
                        <TrendingUp className="h-3 w-3 text-siphon-teal" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-300" />
                      )}
                      Users {row.usersDelta >= 0 ? "+" : ""}
                      {row.usersDelta}
                      {convDeltaPct === null ? "" : ` · Conv ${convDeltaPct >= 0 ? "+" : ""}${convDeltaPct}pp`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
