"use client";

import type { Battle } from "@siphon/core";
import { BattleMode, BattleStatus } from "@siphon/core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Swords, Brain, Code, Sparkles, HelpCircle } from "lucide-react";

interface BattleCardProps {
  battle: Battle;
  currentOwnerId?: string;
  onClick?: () => void;
}

const MODE_CONFIG: Record<
  BattleMode,
  { label: string; icon: React.ReactNode; color: string }
> = {
  [BattleMode.Debate]: {
    label: "Debate",
    icon: <Brain className="h-4 w-4" />,
    color: "text-siphon-teal",
  },
  [BattleMode.Solve]: {
    label: "Code Duel",
    icon: <Code className="h-4 w-4" />,
    color: "text-current",
  },
  [BattleMode.RiddleChain]: {
    label: "Riddle Chain",
    icon: <HelpCircle className="h-4 w-4" />,
    color: "text-deep-violet",
  },
  [BattleMode.CreativeClash]: {
    label: "Creative Clash",
    icon: <Sparkles className="h-4 w-4" />,
    color: "text-ember",
  },
};

const STATUS_CONFIG: Record<
  BattleStatus,
  { label: string; className: string }
> = {
  [BattleStatus.Pending]: {
    label: "Pending",
    className: "border-ghost/30 bg-ghost/10 text-ghost",
  },
  [BattleStatus.Matching]: {
    label: "Matching",
    className: "border-ember/30 bg-ember/10 text-ember",
  },
  [BattleStatus.Active]: {
    label: "Active",
    className: "border-siphon-teal/30 bg-siphon-teal/10 text-siphon-teal animate-pulse",
  },
  [BattleStatus.Judging]: {
    label: "Judging",
    className: "border-deep-violet/30 bg-deep-violet/10 text-deep-violet",
  },
  [BattleStatus.Completed]: {
    label: "Completed",
    className: "border-ghost/30 bg-ghost/10 text-ghost",
  },
  [BattleStatus.Disputed]: {
    label: "Disputed",
    className: "border-red-500/30 bg-red-500/10 text-red-400",
  },
};

export function BattleCard({ battle, currentOwnerId, onClick }: BattleCardProps) {
  const modeInfo = MODE_CONFIG[battle.mode];
  const statusInfo = STATUS_CONFIG[battle.status];

  const isChallenger = currentOwnerId === battle.challenger.keeperId;
  const isDefender = currentOwnerId === battle.defender.keeperId;
  const userSide = isChallenger ? "challenger" : isDefender ? "defender" : null;

  const totalChallengerScore = battle.rounds.reduce(
    (sum, r) => sum + r.scores.challenger,
    0
  );
  const totalDefenderScore = battle.rounds.reduce(
    (sum, r) => sum + r.scores.defender,
    0
  );

  const isWinner =
    battle.winnerId &&
    ((isChallenger && battle.winnerId === battle.challenger.shardId) ||
      (isDefender && battle.winnerId === battle.defender.shardId));
  const isLoser =
    battle.winnerId &&
    ((isChallenger && battle.winnerId !== battle.challenger.shardId) ||
      (isDefender && battle.winnerId !== battle.defender.shardId));
  const isDraw = battle.status === BattleStatus.Completed && !battle.winnerId;

  const eloDelta = isChallenger
    ? battle.challenger.eloDelta
    : isDefender
    ? battle.defender.eloDelta
    : 0;

  return (
    <Card
      className={`cursor-pointer transition-all hover:border-siphon-teal/30 hover:shadow-[0_0_15px_rgba(0,212,170,0.1)] ${
        battle.status === BattleStatus.Active
          ? "border-siphon-teal/20"
          : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={modeInfo.color}>{modeInfo.icon}</span>
            <span className={`text-sm font-medium ${modeInfo.color}`}>
              {modeInfo.label}
            </span>
          </div>
          <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
        </div>

        {/* Participants */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="w-8 h-8 rounded-full bg-siphon-teal/20 border border-siphon-teal/30 flex items-center justify-center">
                <Swords className="h-3.5 w-3.5 text-siphon-teal" />
              </div>
              <p className="text-[10px] text-ghost mt-1 truncate max-w-[60px]">
                {battle.challenger.shardId.slice(0, 6)}...
              </p>
            </div>
            <span className="text-ghost/40 text-xs font-bold">VS</span>
            <div className="text-center">
              <div className="w-8 h-8 rounded-full bg-deep-violet/20 border border-deep-violet/30 flex items-center justify-center">
                <Swords className="h-3.5 w-3.5 text-deep-violet" />
              </div>
              <p className="text-[10px] text-ghost mt-1 truncate max-w-[60px]">
                {battle.defender.shardId.slice(0, 6)}...
              </p>
            </div>
          </div>

          {/* Scores */}
          {battle.rounds.length > 0 && (
            <div className="text-right">
              <div className="flex items-center gap-1 text-sm">
                <span className="text-siphon-teal font-bold">
                  {totalChallengerScore}
                </span>
                <span className="text-ghost/30">-</span>
                <span className="text-deep-violet font-bold">
                  {totalDefenderScore}
                </span>
              </div>
              <p className="text-[10px] text-ghost">
                {battle.rounds.length}/3 rounds
              </p>
            </div>
          )}
        </div>

        {/* Result / Footer */}
        <div className="flex items-center justify-between text-xs">
          {battle.status === BattleStatus.Completed && userSide ? (
            <div className="flex items-center gap-2">
              {isWinner && (
                <span className="text-siphon-teal font-medium">Victory</span>
              )}
              {isLoser && (
                <span className="text-red-400 font-medium">Defeat</span>
              )}
              {isDraw && (
                <span className="text-ghost font-medium">Draw</span>
              )}
              {eloDelta !== 0 && (
                <span
                  className={
                    eloDelta > 0
                      ? "text-siphon-teal"
                      : "text-red-400"
                  }
                >
                  {eloDelta > 0 ? "+" : ""}
                  {eloDelta} ELO
                </span>
              )}
            </div>
          ) : (
            <span className="text-ghost/50">
              {new Date(battle.createdAt).toLocaleDateString()}
            </span>
          )}
          {battle.stakeAmount > 0 && (
            <span className="text-ember font-medium">
              {battle.stakeAmount} ETH
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
