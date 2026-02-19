import type { ReactNode } from "react";
import { getApiBaseUrl } from "@/lib/api-client";

interface TierGateProps {
  tier: string;
  requiredTier: string;
  children: ReactNode;
}

const TIER_ORDER = ["free_trainer", "trainer_plus", "keeper", "keeper_plus", "keeper_pro", "enterprise"];

function tierLevel(tier: string): number {
  const idx = TIER_ORDER.indexOf(tier.toLowerCase());
  return idx >= 0 ? idx : 0;
}

export default function TierGate({ tier, requiredTier, children }: TierGateProps) {
  if (tierLevel(tier) >= tierLevel(requiredTier)) {
    return <>{children}</>;
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-deep-violet/20 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🔒</span>
        </div>
        <h2 className="text-xl font-semibold mb-2">
          {requiredTier}+ Required
        </h2>
        <p className="text-ghost text-sm mb-6">
          The Workspace zone requires a {requiredTier} subscription or higher.
          Upgrade to unlock local agent execution, file operations, and shell access.
        </p>
        <a
          href={`${getApiBaseUrl()}/subscribe`}
          target="_blank"
          rel="noreferrer"
          className="inline-block px-6 py-2 bg-siphon-teal/20 text-siphon-teal rounded-lg border border-siphon-teal/30 hover:bg-siphon-teal/30 transition-colors"
        >
          Upgrade Plan
        </a>
      </div>
    </div>
  );
}
