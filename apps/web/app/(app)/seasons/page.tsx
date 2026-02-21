"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Entry = {
  rank: number;
  ownerId: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  eloDelta: number;
};

type Payload = {
  season: {
    id: string;
    name: string;
    starts_at: number;
    ends_at: number;
    status: string;
  };
  leaderboard: Entry[];
};

export default function SeasonsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/seasons");
      if (!res.ok) return;
      setData(await res.json());
    };
    void load();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = useMemo(() => {
    if (!data) return "00:00:00";
    const ms = Math.max(0, data.season.ends_at - now);
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${days}d ${String(hours).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m`;
  }, [data, now]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foam">Ranked Seasons</h1>
        <p className="text-ghost text-sm mt-1">Climb monthly ladders and lock in your rank.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{data?.season.name ?? "Current Season"}</CardTitle>
            <Badge>{data?.season.status ?? "active"}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ghost">Season ends in: <span className="text-siphon-teal font-mono">{remaining}</span></p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.leaderboard ?? []).slice(0, 50).map((entry) => (
            <div key={`${entry.ownerId}-${entry.rank}`} className="flex items-center justify-between rounded-lg border border-siphon-teal/10 bg-abyss/50 px-3 py-2">
              <div className="text-sm text-foam">
                #{entry.rank} {entry.ownerId.slice(0, 6)}...{entry.ownerId.slice(-4)}
              </div>
              <div className="text-xs text-ghost">
                {entry.points} pts · {entry.wins}W/{entry.losses}L/{entry.draws}D · {entry.eloDelta >= 0 ? "+" : ""}
                {entry.eloDelta} ELO
              </div>
            </div>
          ))}
          {(data?.leaderboard.length ?? 0) === 0 && (
            <p className="text-sm text-ghost">No ranked matches recorded this season yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

