"use client";

import { useState, useEffect, useCallback } from "react";
import type { WildShard, CaptureChallenge as ChallengeType } from "@siphon/core";
import { getShardTypeName, SHARD_TYPE_COLORS, SHARD_TYPE_NAMES } from "@siphon/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import {
  SHARD_REGISTRY_ABI,
  SHARD_REGISTRY_ADDRESS,
  getWalletClient,
  publicClient,
  idToBytes32,
} from "@/lib/contracts";
import { playSfx, triggerCelebration, updateOnboardingProgress } from "@/lib/game-feedback";

interface CaptureDialogProps {
  shard: WildShard | null;
  open: boolean;
  onClose: () => void;
  onCaptured: () => void;
  ownerId: string;
}

type Phase = "loading" | "challenge" | "submitting" | "success" | "registering" | "failure";

export function CaptureDialog({
  shard,
  open,
  onClose,
  onCaptured,
  ownerId,
}: CaptureDialogProps) {
  const { address } = useAccount();
  const [phase, setPhase] = useState<Phase>("loading");
  const [challenge, setChallenge] = useState<ChallengeType | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  const [capturedShard, setCapturedShard] = useState<any>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  const loadChallenge = useCallback(async () => {
    if (!shard) return;
    setPhase("loading");
    setAnswer("");
    setFeedback("");
    setTimeLeft(60);
    setChallengeId(null);

    try {
      const res = await fetch("/api/shards/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shardId: shard.id, ownerId }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.error || "Failed to start capture";
        toast.error(errorMsg);
        setFeedback(errorMsg);
        setPhase("failure");
        return;
      }

      if (data.challenge) {
        setChallenge(data.challenge);
        setChallengeId(data.challengeId ?? null);
        setPhase("challenge");
      }
    } catch {
      toast.error("Connection lost. Check your network and try again.");
      setFeedback("Connection lost. Check your network and try again.");
      setPhase("failure");
    }
  }, [shard, ownerId]);

  useEffect(() => {
    if (open && shard) {
      loadChallenge();
    }
  }, [open, shard, loadChallenge]);

  // Countdown timer
  useEffect(() => {
    if (phase !== "challenge") return;
    if (timeLeft <= 0) {
      playSfx("capture_fail");
      setPhase("failure");
      setFeedback("Time's up! The Shard drifted away.");
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, timeLeft]);

  const submitAnswer = async () => {
    if (!shard || !answer.trim() || !challengeId) return;
    setPhase("submitting");

    try {
    const res = await fetch("/api/shards/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shardId: shard.id, answer, ownerId, challengeId }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data.error || "Capture failed";
      toast.error(errorMsg);
      setFeedback(errorMsg);
      setPhase("failure");
      return;
    }

    setFeedback(data.feedback);

    if (data.success) {
      setCapturedShard(data.shard);
      playSfx("capture_success");
      triggerCelebration("capture");
      updateOnboardingProgress(ownerId, { captured: true });

      // Try on-chain registration if wallet connected
      if (data.needsOnChainRegistration && address) {
        setPhase("registering");
        try {
          const walletClient = await getWalletClient();
          if (walletClient && data.shard) {
            const shardIdBytes = idToBytes32(data.shard.id);
            const genomeHash = data.shard.genomeHash as `0x${string}`;

            const hash = await walletClient.writeContract({
              address: SHARD_REGISTRY_ADDRESS as `0x${string}`,
              abi: SHARD_REGISTRY_ABI,
              functionName: "register",
              args: [shardIdBytes, genomeHash],
              account: address,
            });
            await publicClient.waitForTransactionReceipt({ hash });
          }
        } catch (err) {
          // Non-blocking: on-chain registration is optional at capture time
          console.warn("On-chain registration skipped:", err);
        }
      }

      setPhase("success");
    } else {
      playSfx("capture_fail");
      setPhase("failure");
    }
    } catch {
      toast.error("Connection lost. Check your network and try again.");
      setFeedback("Connection lost. Check your network and try again.");
      setPhase("failure");
    }
  };

  if (!shard) return null;

  const typeName = getShardTypeName(shard.type);
  const color = SHARD_TYPE_COLORS[typeName as keyof typeof SHARD_TYPE_COLORS];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md border-siphon-teal/35 bg-[#071123]/95">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div
              className="h-9 w-9 flex items-center justify-center text-lg border"
              style={{
                backgroundColor: color + "20",
                color: color,
                boxShadow: `0 0 15px ${color}40`,
                borderColor: `${color}80`,
              }}
            >
              {["◈", "◇", "▣", "✦", "⬡", "⚖", "⛨", "◐"][shard.type] ?? "◈"}
            </div>
            <span className="pixel-title text-[10px]">Wild {shard.name}</span>
          </DialogTitle>
          <DialogDescription>
            {shard.species} &middot; {typeName} Shard
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {phase === "loading" && (
            <div className="text-center py-8 reveal-up">
              <div className="animate-pulse text-siphon-teal pixel-title text-[10px]">
                Generating challenge...
              </div>
            </div>
          )}

          {phase === "challenge" && challenge && (
            <div className="reveal-up space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="uppercase tracking-wide">
                  {challenge.type.replace("_", " ")}
                </Badge>
                <span
                  className={`text-sm font-mono px-2 py-1 border ${
                    timeLeft <= 10
                      ? "text-red-300 border-red-400/60 bg-red-950/20 animate-[danger-blink_1s_ease-in-out_infinite]"
                      : "text-ghost border-siphon-teal/20 bg-abyss/60"
                  }`}
                >
                  {timeLeft}s
                </span>
              </div>

              <div className="pixel-panel p-4">
                <div className="h-0.5 w-full mb-3 shimmer-line opacity-60" />
                <p className="text-foam whitespace-pre-line">
                  {challenge.prompt}
                </p>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Your answer..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitAnswer()}
                  autoFocus
                />
                <Button onClick={submitAnswer} disabled={!answer.trim()}>
                  Submit
                </Button>
              </div>
            </div>
          )}

          {phase === "submitting" && (
            <div className="text-center py-8 reveal-up">
              <div className="animate-pulse text-siphon-teal pixel-title text-[10px]">Evaluating...</div>
            </div>
          )}

          {phase === "registering" && (
            <div className="text-center py-8 reveal-up">
              <div className="animate-pulse text-siphon-teal">
                Registering on-chain...
              </div>
              <p className="text-xs text-ghost mt-2">
                Confirm the transaction in your wallet
              </p>
            </div>
          )}

          {phase === "success" && (
            <div className="text-center py-4 space-y-3 reveal-up">
              <div
                className="text-4xl mx-auto w-16 h-16 flex items-center justify-center border-2"
                style={{
                  backgroundColor: color + "20",
                  boxShadow: `0 0 30px ${color}40`,
                  borderColor: `${color}80`,
                }}
              >
                {["◈", "◇", "▣", "✦", "⬡", "⚖", "⛨", "◐"][shard.type] ?? "◈"}
              </div>
              <h3 className="pixel-title text-[11px] text-siphon-teal">
                Shard Captured!
              </h3>
              <p className="text-ghost">{feedback}</p>
              <Button
                onClick={() => {
                  onCaptured();
                  onClose();
                }}
              >
                Add to Collection
              </Button>
            </div>
          )}

          {phase === "failure" && (
            <div className="text-center py-4 space-y-3 reveal-up">
              <div className="text-4xl">💨</div>
              <h3 className="pixel-title text-[11px] text-ghost">
                The Shard escaped...
              </h3>
              <p className="text-ghost">{feedback}</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={onClose}>
                  Give Up
                </Button>
                <Button onClick={loadChallenge}>Try Again</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
