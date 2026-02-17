"use client";

import { useState, useEffect } from "react";
import type { MatchmakingEntry } from "@siphon/core";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, X, Search } from "lucide-react";

interface MatchmakingQueueProps {
  entry: MatchmakingEntry;
  onCancel: (entryId: string) => void;
}

export function MatchmakingQueue({ entry, onCancel }: MatchmakingQueueProps) {
  const [elapsed, setElapsed] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - entry.joinedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [entry.joinedAt]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  const handleCancel = async () => {
    setCancelling(true);
    onCancel(entry.id);
  };

  return (
    <Card className="border-siphon-teal/20 bg-gradient-to-r from-midnight to-abyss">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Animated search indicator */}
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-siphon-teal/30 flex items-center justify-center">
                <Search className="h-5 w-5 text-siphon-teal" />
              </div>
              {/* Pulsing ring animation */}
              <div className="absolute inset-0 rounded-full border-2 border-siphon-teal/20 animate-ping" />
              <div
                className="absolute inset-[-4px] rounded-full border border-siphon-teal/10 animate-ping"
                style={{ animationDelay: "0.5s" }}
              />
            </div>

            <div>
              <p className="text-foam font-medium text-sm">
                Searching for opponent...
              </p>
              <p className="text-ghost text-xs mt-0.5">
                Mode: <span className="text-siphon-teal capitalize">{entry.mode.replace("_", " ")}</span>
                {" | "}
                ELO: <span className="text-foam">{entry.eloRating}</span>
                {entry.stakeAmount > 0 && (
                  <>
                    {" | "}
                    Stake: <span className="text-ember">{entry.stakeAmount} ETH</span>
                  </>
                )}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Loader2 className="h-3 w-3 text-siphon-teal animate-spin" />
                <span className="text-xs text-ghost/60 font-mono">
                  {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                </span>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={cancelling}
            className="text-ghost hover:text-red-400 hover:bg-red-400/10"
          >
            {cancelling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
            <span className="ml-1.5">Cancel</span>
          </Button>
        </div>

        {/* Progress bar animation */}
        <div className="mt-4 h-1 rounded-full bg-abyss overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-siphon-teal to-deep-violet rounded-full transition-all"
            style={{
              width: `${Math.min(100, (elapsed / 120) * 100)}%`,
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
        </div>
        {elapsed > 60 && (
          <p className="text-[10px] text-ghost/40 mt-1.5">
            Expanding search range to find a suitable opponent...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
