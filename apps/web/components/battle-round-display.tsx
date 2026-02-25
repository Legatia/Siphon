"use client";

import type { BattleRound } from "@siphon/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface BattleRoundDisplayProps {
  round: BattleRound;
  challengerName: string;
  defenderName: string;
  isRevealed: boolean;
}

export function BattleRoundDisplay({
  round,
  challengerName,
  defenderName,
  isRevealed,
}: BattleRoundDisplayProps) {
  const challengerWon = round.scores.challenger > round.scores.defender;
  const defenderWon = round.scores.defender > round.scores.challenger;
  const isDraw = round.scores.challenger === round.scores.defender;

  return (
    <Card className="overflow-hidden border-siphon-teal/25 bg-[#071123]/85">
      <div className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(106,245,214,0.06) 1px, transparent 1px), linear-gradient(0deg, rgba(106,245,214,0.06) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />
      <CardHeader className="relative pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="pixel-title text-[11px] text-foam">
            Round {round.roundNumber}
          </CardTitle>
          {isRevealed && (round.scores.challenger > 0 || round.scores.defender > 0) && (
            <Badge
              variant={isDraw ? "secondary" : "default"}
              className={
                isDraw
                  ? ""
                  : challengerWon
                  ? "border-siphon-teal/30 bg-siphon-teal/10 text-siphon-teal"
                  : "border-coral/30 bg-coral/10 text-coral"
              }
            >
              {isDraw
                ? "Draw"
                : challengerWon
                ? `${challengerName} wins`
                : `${defenderName} wins`}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <div className="pixel-panel p-4">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-siphon-teal">
            Prompt
          </p>
          <p className="leading-relaxed text-foam/90">{round.prompt}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div
            className={`border p-4 ${
              isRevealed && challengerWon
                ? "border-siphon-teal/35 bg-siphon-teal/8 shadow-[0_0_16px_rgba(0,212,170,0.15)]"
                : "border-ghost/15 bg-abyss/45"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-siphon-teal">
                {challengerName}
              </p>
              {isRevealed && (
                <span className="font-mono text-sm font-bold text-siphon-teal">
                  {round.scores.challenger}
                </span>
              )}
            </div>
            <p className="leading-relaxed text-ghost">
              {round.challengerResponse || (
                <span className="italic text-ghost/40">Waiting for response...</span>
              )}
            </p>
          </div>

          <div
            className={`border p-4 ${
              isRevealed && defenderWon
                ? "border-coral/35 bg-coral/8 shadow-[0_0_16px_rgba(255,143,112,0.15)]"
                : "border-ghost/15 bg-abyss/45"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-coral">
                {defenderName}
              </p>
              {isRevealed && (
                <span className="font-mono text-sm font-bold text-coral">
                  {round.scores.defender}
                </span>
              )}
            </div>
            <p className="leading-relaxed text-ghost">
              {round.defenderResponse || (
                <span className="italic text-ghost/40">Waiting for response...</span>
              )}
            </p>
          </div>
        </div>

        {isRevealed && round.reasoning && (
          <div className="border border-ghost/15 bg-midnight p-4">
            <p className="mb-1.5 flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-ghost">
              <Sparkles className="h-3 w-3" />
              Judge Reasoning
            </p>
            <p className="italic leading-relaxed text-ghost/85">{round.reasoning}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
