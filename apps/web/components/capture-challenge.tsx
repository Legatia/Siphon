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

interface CaptureDialogProps {
  shard: WildShard | null;
  open: boolean;
  onClose: () => void;
  onCaptured: () => void;
  ownerId: string;
}

type Phase = "loading" | "challenge" | "submitting" | "success" | "failure";

export function CaptureDialog({
  shard,
  open,
  onClose,
  onCaptured,
  ownerId,
}: CaptureDialogProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [challenge, setChallenge] = useState<ChallengeType | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);

  const loadChallenge = useCallback(async () => {
    if (!shard) return;
    setPhase("loading");
    setAnswer("");
    setFeedback("");
    setTimeLeft(60);

    const res = await fetch("/api/shards/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shardId: shard.id, ownerId }),
    });

    const data = await res.json();
    if (data.challenge) {
      setChallenge(data.challenge);
      setPhase("challenge");
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
      setPhase("failure");
      setFeedback("Time's up! The Shard drifted away.");
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, timeLeft]);

  const submitAnswer = async () => {
    if (!shard || !answer.trim()) return;
    setPhase("submitting");

    const res = await fetch("/api/shards/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shardId: shard.id, answer, ownerId }),
    });

    const data = await res.json();
    setFeedback(data.feedback);

    if (data.success) {
      setPhase("success");
    } else {
      setPhase("failure");
    }
  };

  if (!shard) return null;

  const typeName = getShardTypeName(shard.type);
  const color = SHARD_TYPE_COLORS[typeName as keyof typeof SHARD_TYPE_COLORS];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
              style={{
                backgroundColor: color + "20",
                color: color,
                boxShadow: `0 0 15px ${color}40`,
              }}
            >
              {["◈", "◇", "▣", "✦", "⬡", "⚖", "⛨", "◐"][shard.type] ?? "◈"}
            </div>
            <span>Wild {shard.name}</span>
          </DialogTitle>
          <DialogDescription>
            {shard.species} &middot; {typeName} Shard
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {phase === "loading" && (
            <div className="text-center py-8">
              <div className="animate-pulse text-siphon-teal">
                Generating challenge...
              </div>
            </div>
          )}

          {phase === "challenge" && challenge && (
            <>
              <div className="flex items-center justify-between">
                <Badge variant="secondary">
                  {challenge.type.replace("_", " ")}
                </Badge>
                <span
                  className={`text-sm font-mono ${
                    timeLeft <= 10 ? "text-red-400" : "text-ghost"
                  }`}
                >
                  {timeLeft}s
                </span>
              </div>

              <div className="bg-abyss/80 rounded-lg p-4 border border-siphon-teal/10">
                <p className="text-sm text-foam whitespace-pre-line">
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
            </>
          )}

          {phase === "submitting" && (
            <div className="text-center py-8">
              <div className="animate-pulse text-siphon-teal">Evaluating...</div>
            </div>
          )}

          {phase === "success" && (
            <div className="text-center py-4 space-y-3">
              <div
                className="text-4xl mx-auto w-16 h-16 flex items-center justify-center rounded-full"
                style={{
                  backgroundColor: color + "20",
                  boxShadow: `0 0 30px ${color}40`,
                }}
              >
                {["◈", "◇", "▣", "✦", "⬡", "⚖", "⛨", "◐"][shard.type] ?? "◈"}
              </div>
              <h3 className="text-lg font-semibold text-siphon-teal">
                Shard Captured!
              </h3>
              <p className="text-sm text-ghost">{feedback}</p>
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
            <div className="text-center py-4 space-y-3">
              <div className="text-4xl">💨</div>
              <h3 className="text-lg font-semibold text-ghost">
                The Shard escaped...
              </h3>
              <p className="text-sm text-ghost">{feedback}</p>
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
