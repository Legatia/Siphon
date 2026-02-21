"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Achievement = {
  key: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedAt: number | null;
};

export default function AchievementsPage() {
  const { address } = useAccount();
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    if (!address) return;
    fetch(`/api/achievements?ownerId=${address}`)
      .then((r) => r.json())
      .then((data) => setAchievements(data.achievements ?? []))
      .catch(() => setAchievements([]));
  }, [address]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foam">Achievements</h1>
        <p className="text-ghost text-sm mt-1">Unlock milestones as you progress.</p>
      </div>

      {!address ? (
        <Card className="p-10 text-center text-ghost">Connect wallet to view achievements.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {achievements.map((a) => (
            <Card key={a.key} className={a.unlocked ? "border-siphon-teal/30" : "opacity-70"}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{a.name}</CardTitle>
                  <Badge variant={a.unlocked ? "default" : "secondary"}>
                    {a.unlocked ? "Unlocked" : "Locked"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-ghost">{a.description}</p>
                {a.unlockedAt && (
                  <p className="text-xs text-siphon-teal mt-2">
                    {new Date(a.unlockedAt).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

