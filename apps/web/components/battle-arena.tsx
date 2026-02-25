"use client";

import type { Battle, Shard } from "@siphon/core";
import { BattleStatus } from "@siphon/core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Swords, Trophy, Minus, Radio, Shield } from "lucide-react";

interface BattleArenaProps {
  battle: Battle;
  challengerShard: Shard | null;
  defenderShard: Shard | null;
}

const CHALLENGER_COLOR = "text-siphon-teal";
const DEFENDER_COLOR = "text-coral";

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
    maxPossibleScore > 0 ? (totalChallengerScore / maxPossibleScore) * 100 : 0;
  const defenderPercent =
    maxPossibleScore > 0 ? (totalDefenderScore / maxPossibleScore) * 100 : 0;

  const isCompleted = battle.status === BattleStatus.Completed;
  const challengerWon = isCompleted && battle.winnerId === battle.challenger.shardId;
  const defenderWon = isCompleted && battle.winnerId === battle.defender.shardId;
  const isDraw = isCompleted && !battle.winnerId;

  return (
    <Card className="relative overflow-hidden border-siphon-teal/30 bg-[#081226]/90 reveal-up">
      <div className="particle-bg absolute inset-0 opacity-45" />
      <div className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(106,245,214,0.08) 1px, transparent 1px), linear-gradient(0deg, rgba(106,245,214,0.08) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      <CardContent className="relative p-5 sm:p-6">
        <div className="mb-6 text-center animate-[hud-flicker_5s_steps(1)_infinite]">
          {isCompleted ? (
            <div className="inline-flex items-center justify-center gap-2 pixel-chip px-3 py-2">
              <Trophy className="h-5 w-5 text-amber-300" />
              <span className="pixel-title text-[10px] text-amber-200">Battle Complete</span>
            </div>
          ) : (
            <>
              <p className="mb-2 flex items-center justify-center gap-2 text-[11px] uppercase tracking-wider text-ghost">
                <Radio className="h-3.5 w-3.5 animate-pulse" />
                Live Arena Feed
              </p>
              <div className="flex items-center justify-center gap-2">
                {Array.from({ length: totalRounds }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-3 w-3 rounded-none transition-colors ${
                      i < currentRound
                        ? "bg-siphon-teal shadow-[0_0_8px_rgba(0,212,170,0.6)]"
                        : "bg-ghost/20"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-1 text-[11px] text-ghost">
                Round {Math.min(currentRound + 1, totalRounds)} of {totalRounds}
              </p>
            </>
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4">
          <div className="text-center">
            <div
              className={`relative mx-auto flex h-24 w-24 items-center justify-center border-2 bg-siphon-teal/10 transition-all ${
                challengerWon
                  ? "border-siphon-teal shadow-[0_0_24px_rgba(0,212,170,0.5)]"
                  : isCompleted && !challengerWon
                  ? "border-ghost/20 opacity-60"
                  : "border-siphon-teal/45"
              }`}
            >
              <Swords className="h-9 w-9 text-siphon-teal" />
              {challengerWon && (
                <Trophy className="absolute -right-2 -top-2 h-5 w-5 text-amber-300" />
              )}
            </div>
            <p className={`mt-3 text-sm font-medium ${CHALLENGER_COLOR}`}>
              {challengerShard?.name ?? `${battle.challenger.shardId.slice(0, 8)}...`}
            </p>
            <p className="text-xs text-ghost">{challengerShard?.species ?? "Unknown"}</p>
            <p className="mt-0.5 text-xs text-ghost/60">
              ELO {battle.challenger.eloRating}
              {battle.challenger.eloDelta !== 0 && (
                <span className={battle.challenger.eloDelta > 0 ? " text-siphon-teal" : " text-red-400"}>
                  {` (${battle.challenger.eloDelta > 0 ? "+" : ""}${battle.challenger.eloDelta})`}
                </span>
              )}
            </p>
          </div>

          <div className="flex min-w-[164px] flex-col items-center gap-2">
            <div className="pixel-panel px-3 py-3 animate-[score-pulse_1.6s_ease-in-out_infinite]">
              <div className="flex items-center gap-2 font-mono text-2xl font-bold sm:text-3xl">
                <AnimatedNumber value={totalChallengerScore} className={CHALLENGER_COLOR} />
                <Minus className="h-4 w-4 text-ghost/40" />
                <AnimatedNumber value={totalDefenderScore} className={DEFENDER_COLOR} />
              </div>
            </div>
            <p className="text-[10px] uppercase tracking-wider text-ghost/80">Score Matrix</p>
            {isDraw && <Badge variant="secondary">Draw</Badge>}
          </div>

          <div className="text-center">
            <div
              className={`relative mx-auto flex h-24 w-24 items-center justify-center border-2 bg-coral/10 transition-all ${
                defenderWon
                  ? "border-coral shadow-[0_0_24px_rgba(255,143,112,0.45)]"
                  : isCompleted && !defenderWon
                  ? "border-ghost/20 opacity-60"
                  : "border-coral/45"
              }`}
            >
              <Shield className="h-9 w-9 text-coral" />
              {defenderWon && (
                <Trophy className="absolute -right-2 -top-2 h-5 w-5 text-amber-300" />
              )}
            </div>
            <p className={`mt-3 text-sm font-medium ${DEFENDER_COLOR}`}>
              {defenderShard?.name ?? `${battle.defender.shardId.slice(0, 8)}...`}
            </p>
            <p className="text-xs text-ghost">{defenderShard?.species ?? "Unknown"}</p>
            <p className="mt-0.5 text-xs text-ghost/60">
              ELO {battle.defender.eloRating}
              {battle.defender.eloDelta !== 0 && (
                <span className={battle.defender.eloDelta > 0 ? " text-siphon-teal" : " text-red-400"}>
                  {` (${battle.defender.eloDelta > 0 ? "+" : ""}${battle.defender.eloDelta})`}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex items-center gap-3">
            <span className={`w-24 text-right text-xs ${CHALLENGER_COLOR}`}>Challenger</span>
            <div className="flex-1">
              <Progress
                value={challengerPercent}
                className="h-3 rounded-none border border-siphon-teal/20 bg-abyss [&>div]:bg-siphon-teal"
              />
            </div>
            <span className="w-8 text-xs text-ghost">{Math.round(challengerPercent)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`w-24 text-right text-xs ${DEFENDER_COLOR}`}>Defender</span>
            <div className="flex-1">
              <Progress
                value={defenderPercent}
                className="h-3 rounded-none border border-coral/35 bg-abyss [&>div]:bg-coral [&>div]:shadow-[0_0_10px_rgba(255,143,112,0.45)]"
              />
            </div>
            <span className="w-8 text-xs text-ghost">{Math.round(defenderPercent)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
