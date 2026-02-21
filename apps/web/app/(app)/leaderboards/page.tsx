"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type RankedShard = {
  shardId: string;
  name: string;
  species: string;
  level: number;
  elo: number;
  wins: number;
};

type Payload = {
  global: RankedShard[];
  modeWins: RankedShard[];
  weeklyWinners: RankedShard[];
};

export default function LeaderboardsPage() {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    fetch("/api/leaderboards")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ global: [], modeWins: [], weeklyWinners: [] }));
  }, []);

  const renderRows = (rows: RankedShard[], showWins = false) => (
    <div className="space-y-2">
      {rows.slice(0, 20).map((row, idx) => (
        <div
          key={`${row.shardId}-${idx}`}
          className="flex items-center justify-between rounded-lg border border-siphon-teal/10 bg-abyss/50 px-3 py-2"
        >
          <div className="flex items-center gap-3">
            <Badge variant="secondary">#{idx + 1}</Badge>
            <div>
              <p className="text-sm text-foam">{row.name}</p>
              <p className="text-xs text-ghost">{row.species} · Lvl {row.level}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-siphon-teal font-mono">ELO {row.elo}</p>
            {showWins && <p className="text-xs text-ghost">{row.wins} wins</p>}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foam">Leaderboards</h1>
        <p className="text-ghost text-sm mt-1">Global rank, wins, and weekly leaders.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Global ELO</CardTitle>
          </CardHeader>
          <CardContent>{renderRows(data?.global ?? [])}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most Wins</CardTitle>
          </CardHeader>
          <CardContent>{renderRows(data?.modeWins ?? [], true)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weekly Top</CardTitle>
          </CardHeader>
          <CardContent>{renderRows(data?.weeklyWinners ?? [], true)}</CardContent>
        </Card>
      </div>
    </div>
  );
}
