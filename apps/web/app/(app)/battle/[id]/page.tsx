"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BattleStatus, PROTOCOL_CONSTANTS, generateBattlePrompt } from "@siphon/core";
import type { Battle, Shard, BattleRound } from "@siphon/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BattleArena } from "@/components/battle-arena";
import { BattleRoundDisplay } from "@/components/battle-round-display";
import {
  Loader2,
  Send,
  ArrowLeft,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock3,
  Share2,
  Target,
} from "lucide-react";
import { playSfx, triggerCelebration, updateOnboardingProgress } from "@/lib/game-feedback";
import { toast } from "sonner";

const MAX_RESPONSE_LENGTH = 2000;

export default function BattleLivePage() {
  const { address } = useAccount();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const battleId = params.id as string;

  const [battle, setBattle] = useState<Battle | null>(null);
  const [challengerShard, setChallengerShard] = useState<Shard | null>(null);
  const [defenderShard, setDefenderShard] = useState<Shard | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [settling, setSettling] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const lastOpponentResponseCount = useRef(0);

  const fetchBattle = useCallback(async () => {
    try {
      const res = await fetch(`/api/battles/${battleId}`);
      if (!res.ok) {
        setError("Battle not found");
        return;
      }
      const data: Battle = await res.json();
      setBattle(data);

      // Fetch shard details
      const [cRes, dRes] = await Promise.all([
        fetch(`/api/shards/${data.challenger.shardId}`).catch(() => null),
        fetch(`/api/shards/${data.defender.shardId}`).catch(() => null),
      ]);
      if (cRes?.ok) setChallengerShard(await cRes.json());
      if (dRes?.ok) setDefenderShard(await dRes.json());
    } catch {
      setError("Failed to load battle");
    } finally {
      setLoading(false);
    }
  }, [battleId]);

  useEffect(() => {
    fetchBattle();
    const interval = setInterval(fetchBattle, 5000);
    return () => clearInterval(interval);
  }, [fetchBattle]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-siphon-teal animate-spin" />
      </div>
    );
  }

  if (error || !battle) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/battle")}
          className="text-ghost hover:text-foam"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Arena
        </Button>
        <Card className="p-12 text-center">
          <p className="text-ghost">{error ?? "Battle not found"}</p>
        </Card>
      </div>
    );
  }

  const isChallenger = address === battle.challenger.keeperId;
  const isDefender = address === battle.defender.keeperId;
  const isParticipant = isChallenger || isDefender;
  const spectateMode = searchParams.get("spectate") === "1" || !isParticipant;
  const myShardId = isChallenger
    ? battle.challenger.shardId
    : isDefender
    ? battle.defender.shardId
    : null;

  const totalRounds = PROTOCOL_CONSTANTS.BATTLE_ROUNDS;
  const currentRoundNumber = battle.rounds.length + 1;
  const isCompleted = battle.status === BattleStatus.Completed;

  // Find the current round that needs a response from this user
  const pendingRound = battle.rounds.find((r) => {
    if (isChallenger && !r.challengerResponse) return true;
    if (isDefender && !r.defenderResponse) return true;
    return false;
  });
  const virtualRound: BattleRound | null =
    !pendingRound && battle.rounds.length < totalRounds && isParticipant
      ? {
          roundNumber: currentRoundNumber,
          prompt: generateBattlePrompt(battle.mode, currentRoundNumber),
          challengerResponse: "",
          defenderResponse: "",
          scores: { challenger: 0, defender: 0 },
          startedAt: Date.now(),
          dueAt: Date.now() + PROTOCOL_CONSTANTS.BATTLE_TURN_TIME_LIMIT_MS,
        }
      : null;
  const activeRound = pendingRound ?? virtualRound;

  // Check if all rounds are done and ready for settlement
  const allRoundsPlayed =
    battle.rounds.length >= totalRounds &&
    battle.rounds.every(
      (r) => r.challengerResponse && r.defenderResponse
    );

  const canSettle =
    allRoundsPlayed &&
    battle.status === BattleStatus.Active &&
    isParticipant;

  const handleSubmitResponse = async () => {
    if (!activeRound || !myShardId || !response.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/battles/${battleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round: activeRound.roundNumber,
          shardId: myShardId,
          response: response.trim(),
        }),
      });

      if (res.ok) {
        playSfx("battle_submit");
        setResponse("");
        await fetchBattle();
      }
    } catch (err) {
      console.error("Failed to submit response:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTimedAutoSubmit = useCallback(async () => {
    if (!activeRound || !myShardId || !isParticipant || isCompleted) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/battles/${battleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round: activeRound.roundNumber,
          shardId: myShardId,
          response: "",
          timedOut: true,
        }),
      });
      if (res.ok) {
        toast.error("Turn timed out. Auto-submitted.");
        playSfx("timer_warning");
        await fetchBattle();
      }
    } finally {
      setSubmitting(false);
    }
  }, [activeRound, myShardId, isParticipant, isCompleted, battleId, fetchBattle]);

  const handleSettle = async () => {
    setSettling(true);
    try {
      const res = await fetch(`/api/battles/${battleId}/settle`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchBattle();
      }
    } catch (err) {
      console.error("Failed to settle battle:", err);
    } finally {
      setSettling(false);
    }
  };

  // Compute result display for completed battles
  const myEloDelta = isChallenger
    ? battle.challenger.eloDelta
    : isDefender
    ? battle.defender.eloDelta
    : 0;
  const didWin =
    isCompleted &&
    battle.winnerId &&
    ((isChallenger && battle.winnerId === battle.challenger.shardId) ||
      (isDefender && battle.winnerId === battle.defender.shardId));
  const didLose =
    isCompleted &&
    battle.winnerId &&
    !didWin;
  const isDraw = isCompleted && !battle.winnerId;
  const payoutFinalized = battle.stakeAmount <= 0 || !!battle.finalizationTxHash;

  useEffect(() => {
    if (!isParticipant) return;
    const opponentResponses = battle.rounds.filter((r) =>
      isChallenger ? !!r.defenderResponse : !!r.challengerResponse
    ).length;
    if (opponentResponses > lastOpponentResponseCount.current) {
      toast.success("Opponent submitted a response.");
    }
    lastOpponentResponseCount.current = opponentResponses;
  }, [battle.rounds, isChallenger, isParticipant]);

  useEffect(() => {
    if (!activeRound?.dueAt || !isParticipant || isCompleted) {
      setTimeLeft(null);
      return;
    }
    const tick = () => {
      const ms = activeRound.dueAt! - Date.now();
      const sec = Math.max(0, Math.ceil(ms / 1000));
      setTimeLeft(sec);
      if (sec === 10) playSfx("timer_warning");
      if (sec <= 0) void handleTimedAutoSubmit();
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeRound?.dueAt, isParticipant, isCompleted, handleTimedAutoSubmit]);

  useEffect(() => {
    if (!isCompleted || !isParticipant || !address) return;
    updateOnboardingProgress(address, { battled: true });
    if (didWin) {
      playSfx("battle_win");
      triggerCelebration("battle_win");
    } else if (didLose) {
      playSfx("battle_lose");
    }
  }, [isCompleted, isParticipant, address, didWin, didLose]);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => router.push("/battle")}
        className="text-ghost hover:text-foam"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Arena
      </Button>

      {/* Battle Arena visualization */}
      <BattleArena
        battle={battle}
        challengerShard={challengerShard}
        defenderShard={defenderShard}
      />
      {spectateMode && (
        <Card className="border-siphon-teal/30 bg-siphon-teal/8 reveal-up" style={{ animationDelay: "80ms" }}>
          <CardContent className="p-3 text-sm text-siphon-teal">
            Spectating live battle. Submission controls are disabled.
          </CardContent>
        </Card>
      )}

      {/* Final Result Banner */}
      {isCompleted && isParticipant && (
        <Card
          className={`border ${
            didWin
              ? "border-siphon-teal/30 bg-siphon-teal/5"
              : didLose
              ? "border-red-500/30 bg-red-500/5"
              : "border-ghost/30 bg-ghost/5"
          } reveal-up`}
          style={{ animationDelay: "120ms" }}
        >
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              {didWin && <Trophy className="h-8 w-8 text-ember" />}
              <h2
                className={`text-2xl font-bold ${
                  didWin
                    ? "text-siphon-teal"
                    : didLose
                    ? "text-red-400"
                    : "text-ghost"
                }`}
              >
                {didWin ? "Victory!" : didLose ? "Defeat" : "Draw"}
              </h2>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm">
              {myEloDelta !== 0 && (
                <span
                  className={`flex items-center gap-1 ${
                    myEloDelta > 0 ? "text-siphon-teal" : "text-red-400"
                  }`}
                >
                  {myEloDelta > 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {myEloDelta > 0 ? "+" : ""}
                  {myEloDelta} ELO
                </span>
              )}
              {myEloDelta === 0 && isDraw && (
                <span className="flex items-center gap-1 text-ghost">
                  <Minus className="h-4 w-4" />
                  No ELO change
                </span>
              )}
              {battle.stakeAmount > 0 && (
                <span className="text-ghost">
                  {" | "}
                  {!payoutFinalized ? (
                    <span className="text-amber-400">Payout pending finalization</span>
                  ) : didWin ? (
                    <span className="text-ember">
                      +{battle.stakeAmount} ETH won
                    </span>
                  ) : didLose ? (
                    <span className="text-red-400">
                      -{battle.stakeAmount} ETH lost
                    </span>
                  ) : (
                    <span className="text-ghost">Stake returned</span>
                  )}
                </span>
              )}
            </div>
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const text = encodeURIComponent(
                      `Battle result: ${didWin ? "Victory" : didLose ? "Defeat" : "Draw"} in ${battle.mode}. ELO change ${myEloDelta > 0 ? "+" : ""}${myEloDelta}.`
                    );
                    const url = encodeURIComponent(window.location.href);
                    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
                  }}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Result
                </Button>
                <Link href="/bounties">
                  <Button size="sm">
                    <Target className="h-4 w-4 mr-2" />
                    Convert Skill to Bounty
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Response Input for current round */}
      {!isCompleted && isParticipant && activeRound && (
        <Card className="border-siphon-teal/30 bg-[#071123]/85 reveal-up" style={{ animationDelay: "80ms" }}>
          <CardHeader>
            <CardTitle className="pixel-title text-[11px] text-foam">
              Round {activeRound.roundNumber} - Your Response
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {timeLeft !== null && (
              <div
                className={`flex items-center justify-between border px-3 py-2 ${
                  timeLeft <= 10
                    ? "border-red-400/55 bg-red-950/20 animate-[danger-blink_1s_ease-in-out_infinite]"
                    : "border-siphon-teal/25 bg-abyss/70"
                }`}
              >
                <span className="text-xs text-ghost uppercase tracking-wider">Turn timer</span>
                <span className={`text-sm font-mono ${timeLeft <= 10 ? "text-red-300" : "text-siphon-teal"} flex items-center gap-1`}>
                  <Clock3 className="h-3.5 w-3.5" />
                  {timeLeft}s
                </span>
              </div>
            )}
            {/* Show the prompt */}
            <div className="pixel-panel p-4">
              <p className="text-xs font-medium text-siphon-teal mb-1.5 uppercase tracking-wider">
                Prompt
              </p>
              <p className="text-foam/90 leading-relaxed">
                {activeRound.prompt}
              </p>
            </div>

            {/* Response textarea */}
            <div>
              <textarea
                value={response}
                onChange={(e) =>
                  setResponse(e.target.value.slice(0, MAX_RESPONSE_LENGTH))
                }
                placeholder="Enter your response..."
                rows={6}
                className="flex w-full border border-siphon-teal/25 bg-[#061020] px-4 py-3 text-sm text-foam placeholder:text-ghost/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-siphon-teal/30 focus-visible:border-siphon-teal/50 transition-colors resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-ghost/40">
                  {response.length}/{MAX_RESPONSE_LENGTH} characters
                </p>
                <Button
                  onClick={handleSubmitResponse}
                  disabled={!response.trim() || submitting}
                  size="sm"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1.5" />
                  )}
                  Submit Response
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Waiting for opponent */}
      {!isCompleted &&
        isParticipant &&
        !activeRound &&
        battle.rounds.length > 0 &&
        !allRoundsPlayed && (
          <Card className="p-6 text-center border-ghost/15 bg-[#070f1f]/80">
            <Loader2 className="h-6 w-6 text-ghost animate-spin mx-auto mb-2" />
            <p className="text-ghost">
              Waiting for opponent to submit their response...
            </p>
          </Card>
        )}

      {/* Settle button */}
      {canSettle && (
        <div className="text-center">
          <Button
            onClick={handleSettle}
            disabled={settling}
            variant="secondary"
            size="lg"
          >
            {settling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Settling...
              </>
            ) : (
              <>
                <Trophy className="h-4 w-4 mr-2" />
                Settle Battle
              </>
            )}
          </Button>
          <p className="mt-2 text-xs text-ghost/50">
            All rounds complete. Settle to determine the winner and update ELO
            ratings.
          </p>
        </div>
      )}

      {/* Round History */}
      {battle.rounds.length > 0 && (
        <div className="space-y-4">
          <h2 className="pixel-title text-[11px] text-foam">Round Logs</h2>
          {battle.rounds.map((round) => (
            <BattleRoundDisplay
              key={round.roundNumber}
              round={round}
              challengerName={
                challengerShard?.name ??
                battle.challenger.shardId.slice(0, 8) + "..."
              }
              defenderName={
                defenderShard?.name ??
                battle.defender.shardId.slice(0, 8) + "..."
              }
              isRevealed={
                isCompleted ||
                (!!round.challengerResponse && !!round.defenderResponse)
              }
            />
          ))}
        </div>
      )}

      {/* No rounds yet message */}
      {!isCompleted && battle.rounds.length === 0 && isParticipant && (
        <Card className="border-ghost/15 bg-[#070f1f]/80 p-8 text-center">
          <p className="mb-3 text-ghost">
            The battle has started but no rounds have been initiated yet.
          </p>
          <p className="text-ghost/50 text-xs">
            Rounds will appear here as the battle progresses.
          </p>
        </Card>
      )}
    </div>
  );
}
