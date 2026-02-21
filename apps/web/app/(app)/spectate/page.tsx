"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SpectateBattle = {
  id: string;
  mode: string;
  status: string;
  createdAt: number;
  challenger: { shardId: string; name: string; species: string };
  defender: { shardId: string; name: string; species: string };
};

export default function SpectatePage() {
  const [battles, setBattles] = useState<SpectateBattle[]>([]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/battles/spectate");
      if (!res.ok) return;
      setBattles(await res.json());
    };
    void load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foam">Spectator Mode</h1>
        <p className="text-ghost text-sm mt-1">Watch live ranked battles in progress.</p>
      </div>

      {battles.length === 0 ? (
        <Card className="p-10 text-center text-ghost">No live battles right now.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {battles.map((battle) => (
            <Card key={battle.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base capitalize">{battle.mode.replace("_", " ")}</CardTitle>
                  <Badge>{battle.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-foam">
                  {battle.challenger.name} vs {battle.defender.name}
                </div>
                <div className="text-xs text-ghost">
                  {battle.challenger.species} vs {battle.defender.species}
                </div>
                <Link href={`/battle/${battle.id}?spectate=1`} className="text-siphon-teal text-sm hover:underline">
                  Watch battle
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

