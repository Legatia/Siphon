"use client";

import type { Battle, BattleRound, Shard } from "@siphon/core";
import { BattleStatus } from "@siphon/core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Swords, Trophy, Minus } from "lucide-react";

interface BattleArenaProps {
  battle: Battle;
  challengerShard: Shard | null;
  defenderShard: Shard | null;
}

export function BattleArena({
  battle,
  challengerShard,
  defenderShard,
}: BattleArenaProps) {
  const totalRounds = 3;
  const currentRound = battle.rounds.length;

  const totalChallengerScore = battle.rounds.reduce(
    (sum, r) => sum + r.scores.challenger,
    0
  );
  const totalDefenderScore = battle.rounds.reduce(
    (sum, r) => sum + r.scores.defender,
    0
  );

  const maxPossibleScore = totalRounds * 100;
  const challengerPercent =
    maxPossibleScore > 0
      ? (totalChallengerScore / maxPossibleScore) * 100
      : 0;
  const defenderPercent =
    maxPossibleScore > 0
      ? (totalDefenderScore / maxPossibleScore) * 100
      : 0;

  const isCompleted = battle.status === BattleStatus.Completed;
  const challengerWon =
    isCompleted && battle.winnerId === battle.challenger.shardId;
  const defenderWon =
    isCompleted && battle.winnerId === battle.defender.shardId;
  const isDraw = isCompleted && !battle.winnerId;

  return (
    <Card className="border-siphon-teal/10 overflow-hidden">
      {/* Header gradient */}
      <div className="h-1 bg-gradient-to-r from-siphon-teal via-deep-violet to-siphon-teal" />

      <CardContent className="p-6">
        {/* Round counter */}
        <div className="text-center mb-6">
          {isCompleted ? (
            <div className="flex items-center justify-center gap-2">
              <Trophy className="h-5 w-5 text-ember" />
              <span className="text-foam font-semibold">Battle Complete</span>
            </div>
          ) : (
            <>
              <p className="text-xs text-ghost uppercase tracking-wider mb-1">
                Battle In Progress
              </p>
              <div className="flex items-center justify-center gap-2">
                {Array.from({ length: totalRounds }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      i < currentRound
                        ? "bg-siphon-teal shadow-[0_0_8px_rgba(0,212,170,0.5)]"
                        : "bg-ghost/20"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-ghost mt-1">
                Round {Math.min(currentRound + 1, totalRounds)} of {totalRounds}
              </p>
            </>
          )}
        </div>

        {/* Arena - two shards facing each other */}
        <div className="flex items-center justify-between gap-4">
          {/* Challenger */}
          <div className="flex-1 text-center">
            <div
              className={`relative mx-auto w-20 h-20 rounded-full border-2 flex items-center justify-center transition-all ${
                challengerWon
                  ? "border-siphon-teal bg-siphon-teal/20 shadow-[0_0_25px_rgba(0,212,170,0.4)]"
                  : isCompleted && !challengerWon
                  ? "border-ghost/20 bg-ghost/5 opacity-60"
                  : "border-siphon-teal/40 bg-siphon-teal/10"
              }`}
            >
              <Swords className="h-8 w-8 text-siphon-teal" />
              {challengerWon && (
                <div className="absolute -top-2 -right-2">
                  <Trophy className="h-5 w-5 text-ember" />
                </div>
              )}
            </div>
            <p className="text-foam font-medium text-sm mt-3">
              {challengerShard?.name ?? battle.challenger.shardId.slice(0, 8) + "..."}
            </p>
            <p className="text-ghost text-xs">
              {challengerShard?.species ?? "Unknown"}
            </p>
            <p className="text-xs text-ghost/60 mt-0.5">
              ELO {battle.challenger.eloRating}
              {battle.challenger.eloDelta !== 0 && (
                <span
                  className={
                    battle.challenger.eloDelta > 0
                      ? " text-siphon-teal"
                      : " text-red-400"
                  }
                >
                  {" "}
                  ({battle.challenger.eloDelta > 0 ? "+" : ""}
                  {battle.challenger.eloDelta})
                </span>
              )}
            </p>
          </div>

          {/* VS / Score */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-2xl font-bold flex items-center gap-2">
              <span className="text-siphon-teal">{totalChallengerScore}</span>
              <Minus className="h-4 w-4 text-ghost/30" />
              <span className="text-deep-violet">{totalDefenderScore}</span>
            </div>
            {isDraw && (
              <Badge variant="secondary">Draw</Badge>
            )}
          </div>

          {/* Defender */}
          <div className="flex-1 text-center">
            <div
              className={`relative mx-auto w-20 h-20 rounded-full border-2 flex items-center justify-center transition-all ${
                defenderWon
                  ? "border-deep-violet bg-deep-violet/20 shadow-[0_0_25px_rgba(124,58,237,0.4)]"
                  : isCompleted && !defenderWon
                  ? "border-ghost/20 bg-ghost/5 opacity-60"
                  : "border-deep-violet/40 bg-deep-violet/10"
              }`}
            >
              <Swords className="h-8 w-8 text-deep-violet" />
              {defenderWon && (
                <div className="absolute -top-2 -right-2">
                  <Trophy className="h-5 w-5 text-ember" />
                </div>
              )}
            </div>
            <p className="text-foam font-medium text-sm mt-3">
              {defenderShard?.name ?? battle.defender.shardId.slice(0, 8) + "..."}
            </p>
            <p className="text-ghost text-xs">
              {defenderShard?.species ?? "Unknown"}
            </p>
            <p className="text-xs text-ghost/60 mt-0.5">
              ELO {battle.defender.eloRating}
              {battle.defender.eloDelta !== 0 && (
                <span
                  className={
                    battle.defender.eloDelta > 0
                      ? " text-siphon-teal"
                      : " text-red-400"
                  }
                >
                  {" "}
                  ({battle.defender.eloDelta > 0 ? "+" : ""}
                  {battle.defender.eloDelta})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Score progress bars */}
        <div className="mt-6 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs text-siphon-teal w-20 text-right">
              Challenger
            </span>
            <div className="flex-1">
              <Progress
                value={challengerPercent}
                className="h-2 bg-abyss [&>div]:bg-siphon-teal"
              />
            </div>
            <span className="text-xs text-ghost w-8">
              {Math.round(challengerPercent)}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-deep-violet w-20 text-right">
              Defender
            </span>
            <div className="flex-1">
              <Progress
                value={defenderPercent}
                className="h-2 bg-abyss [&>div]:bg-deep-violet"
              />
            </div>
            <span className="text-xs text-ghost w-8">
              {Math.round(defenderPercent)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
