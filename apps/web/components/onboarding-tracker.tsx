"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { getOnboardingProgress } from "@/lib/game-feedback";
import { Button } from "@/components/ui/button";

type ProgressState = {
  driftVisited: boolean;
  captured: boolean;
  trained: boolean;
  battled: boolean;
};

const defaultState: ProgressState = {
  driftVisited: false,
  captured: false,
  trained: false,
  battled: false,
};

export function OnboardingTracker() {
  const { address } = useAccount();
  const [progress, setProgress] = useState<ProgressState>(defaultState);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!address) return;
    setProgress(getOnboardingProgress(address));
  }, [address]);

  useEffect(() => {
    const handler = (evt: Event) => {
      const detail = (evt as CustomEvent<ProgressState>).detail;
      if (detail) setProgress(detail);
    };
    window.addEventListener("siphon:onboarding", handler as EventListener);
    return () => {
      window.removeEventListener("siphon:onboarding", handler as EventListener);
    };
  }, []);

  const done = progress.driftVisited && progress.captured && progress.trained && progress.battled;
  const nextStep = useMemo(() => {
    if (!progress.driftVisited) return { href: "/drift", label: "Explore Drift" };
    if (!progress.captured) return { href: "/drift", label: "Capture a shard" };
    if (!progress.trained) return { href: "/dashboard", label: "Train your shard" };
    if (!progress.battled) return { href: "/battle", label: "Enter battle" };
    return null;
  }, [progress]);

  if (!address || done || dismissed) return null;

  return (
    <div className="mb-6 rounded-xl border border-siphon-teal/20 bg-midnight/70 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-siphon-teal">Starter Protocol</p>
          <p className="text-sm text-foam mt-1">
            Complete your first loop: Drift to Capture to Train to Battle.
          </p>
          <p className="text-xs text-ghost mt-1">
            Progress: {[progress.driftVisited, progress.captured, progress.trained, progress.battled].filter(Boolean).length}/4
          </p>
        </div>
        <button
          type="button"
          className="text-xs text-ghost hover:text-foam"
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </button>
      </div>
      {nextStep && (
        <div className="mt-3">
          <Link href={nextStep.href}>
            <Button size="sm">{nextStep.label}</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
