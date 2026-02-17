"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { tierMeetsRequirement, TIER_PRICES } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Lock } from "lucide-react";

interface SubscriptionGateProps {
  requiredTier: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function SubscriptionGate({
  requiredTier,
  children,
  fallback,
}: SubscriptionGateProps) {
  const { address } = useAccount();
  const [userTier, setUserTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setUserTier("free_trainer");
      setLoading(false);
      return;
    }

    fetch(`/api/subscriptions?userId=${address}`)
      .then((r) => r.json())
      .then((data) => {
        setUserTier(data.tier || "free_trainer");
        setLoading(false);
      })
      .catch(() => {
        setUserTier("free_trainer");
        setLoading(false);
      });
  }, [address]);

  if (loading) {
    return (
      <div className="text-ghost text-sm animate-pulse py-8 text-center">
        Checking access...
      </div>
    );
  }

  if (userTier && tierMeetsRequirement(userTier, requiredTier)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const tierName = TIER_PRICES[requiredTier]?.name || requiredTier;

  return (
    <Card className="p-8 text-center space-y-4">
      <Lock className="h-12 w-12 text-ghost/30 mx-auto" />
      <div>
        <h3 className="text-lg font-semibold text-foam">
          {tierName} Required
        </h3>
        <p className="text-ghost text-sm mt-1">
          Upgrade to {tierName} to access this feature.
        </p>
      </div>
      <Link href="/subscribe">
        <Button>Upgrade to {tierName}</Button>
      </Link>
    </Card>
  );
}
