"use client";

import type { BattleRound } from "@siphon/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    <Card className="border-siphon-teal/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
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
                  : "border-deep-violet/30 bg-deep-violet/10 text-deep-violet"
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
      <CardContent className="space-y-4">
        {/* Prompt */}
        <div className="rounded-lg bg-abyss/60 border border-siphon-teal/5 p-4">
          <p className="text-xs font-medium text-siphon-teal mb-1.5 uppercase tracking-wider">
            Prompt
          </p>
          <p className="text-sm text-foam/90 leading-relaxed">{round.prompt}</p>
        </div>

        {/* Responses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Challenger Response */}
          <div
            className={`rounded-lg border p-4 ${
              isRevealed && challengerWon
                ? "border-siphon-teal/30 bg-siphon-teal/5"
                : "border-ghost/10 bg-abyss/40"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-siphon-teal uppercase tracking-wider">
                {challengerName}
              </p>
              {isRevealed && (
                <span className="text-sm font-bold text-siphon-teal">
                  {round.scores.challenger}
                </span>
              )}
            </div>
            <p className="text-sm text-ghost leading-relaxed">
              {round.challengerResponse || (
                <span className="italic text-ghost/40">Waiting for response...</span>
              )}
            </p>
          </div>

          {/* Defender Response */}
          <div
            className={`rounded-lg border p-4 ${
              isRevealed && defenderWon
                ? "border-deep-violet/30 bg-deep-violet/5"
                : "border-ghost/10 bg-abyss/40"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-deep-violet uppercase tracking-wider">
                {defenderName}
              </p>
              {isRevealed && (
                <span className="text-sm font-bold text-deep-violet">
                  {round.scores.defender}
                </span>
              )}
            </div>
            <p className="text-sm text-ghost leading-relaxed">
              {round.defenderResponse || (
                <span className="italic text-ghost/40">Waiting for response...</span>
              )}
            </p>
          </div>
        </div>

        {/* Reasoning */}
        {isRevealed && round.reasoning && (
          <div className="rounded-lg bg-midnight border border-ghost/10 p-4">
            <p className="text-xs font-medium text-ghost uppercase tracking-wider mb-1.5">
              Judge Reasoning
            </p>
            <p className="text-sm text-ghost/80 leading-relaxed italic">
              {round.reasoning}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
