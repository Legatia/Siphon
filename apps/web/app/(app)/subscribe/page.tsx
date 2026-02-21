"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TIER_PRICES, TIER_ORDER } from "@/lib/stripe";
import {
  Crown,
  Zap,
  Shield,
  Sparkles,
  Check,
  Star,
  Building2,
  Coins,
  Loader2,
} from "lucide-react";
import { parseUnits } from "viem";
import {
  USDC_ABI,
  USDC_ADDRESS,
  SUBSCRIPTION_STAKING_ABI,
  SUBSCRIPTION_STAKING_ADDRESS,
  getWalletClient,
  publicClient,
} from "@/lib/contracts";
import { toast } from "sonner";

const TIER_ICONS: Record<string, React.ReactNode> = {
  free_trainer: <Zap className="h-6 w-6" />,
  trainer_plus: <Shield className="h-6 w-6" />,
  keeper: <Crown className="h-6 w-6" />,
  keeper_plus: <Star className="h-6 w-6" />,
  keeper_pro: <Sparkles className="h-6 w-6" />,
  enterprise: <Building2 className="h-6 w-6" />,
};

const TIER_COLORS: Record<string, string> = {
  free_trainer: "text-ghost",
  trainer_plus: "text-current",
  keeper: "text-siphon-teal",
  keeper_plus: "text-deep-violet",
  keeper_pro: "text-ember",
  enterprise: "text-foam",
};

const TIER_BORDER_COLORS: Record<string, string> = {
  free_trainer: "border-ghost/20",
  trainer_plus: "border-current/30",
  keeper: "border-siphon-teal/30",
  keeper_plus: "border-deep-violet/30",
  keeper_pro: "border-ember/30",
  enterprise: "border-foam/20",
};

interface SubscriptionData {
  tier: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: number;
  messageCap?: number;
  messageCount?: number;
  messagesRemaining?: number;
  shardLimit?: number;
  stakeAmount?: number;
}

export default function SubscribePage() {
  const { address } = useAccount();
  const [subscription, setSubscription] = useState<SubscriptionData>({
    tier: "free_trainer",
  });
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    fetch(`/api/subscriptions?userId=${address}`)
      .then((r) => r.json())
      .then((data) => {
        setSubscription(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [address]);

  const handleUpgrade = async (tier: string) => {
    if (!address) return;

    setCheckoutLoading(tier);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          userId: address,
          returnUrl: window.location.href,
        }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      toast.error("Checkout failed");
      console.error("Checkout error:", error);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManage = async () => {
    if (!subscription.stripeCustomerId) return;

    try {
      const res = await fetch("/api/subscriptions/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: subscription.stripeCustomerId,
          returnUrl: window.location.href,
        }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      toast.error("Failed to open billing portal");
      console.error("Portal error:", error);
    }
  };

  const [stakingLoading, setStakingLoading] = useState<string | null>(null);

  const handleStake = async (tierKey: string) => {
    if (!address) return;

    const tierConfig = TIER_PRICES[tierKey];
    if (!tierConfig || tierConfig.stakeAlternative === 0) return;

    setStakingLoading(tierKey);
    try {
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("No wallet connected");

      const amount = parseUnits(
        tierConfig.stakeAlternative.toString(),
        6
      ); // USDC has 6 decimals

      // Step 1: Approve USDC transfer
      const approveHash = await walletClient.writeContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: USDC_ABI,
        functionName: "approve",
        args: [SUBSCRIPTION_STAKING_ADDRESS as `0x${string}`, amount],
        account: address,
      });

      // Wait for approval to confirm
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // Step 2: Stake USDC
      const stakeHash = await walletClient.writeContract({
        address: SUBSCRIPTION_STAKING_ADDRESS as `0x${string}`,
        abi: SUBSCRIPTION_STAKING_ABI,
        functionName: "stake",
        args: [amount],
        account: address,
      });

      // Wait for stake to confirm
      await publicClient.waitForTransactionReceipt({ hash: stakeHash });

      // Step 3: Record stake with API (which verifies on-chain)
      const res = await fetch("/api/subscriptions/stake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: address,
          tier: tierKey,
          txHash: stakeHash,
          amount: tierConfig.stakeAlternative,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSubscription((prev) => ({
          ...prev,
          tier: data.tier,
          stakeAmount: data.stakeAmount,
        }));
        toast.success("USDC staked successfully!");
      }
    } catch (error) {
      toast.error("Staking failed");
      console.error("Staking error:", error);
    } finally {
      setStakingLoading(null);
    }
  };

  const currentTierIdx = TIER_ORDER.indexOf(
    subscription.tier as (typeof TIER_ORDER)[number]
  );

  // Don't show enterprise in the grid
  const displayTiers = TIER_ORDER.filter((t) => t !== "enterprise");

  if (!address) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foam">Subscription Plans</h1>
          <p className="text-ghost text-sm mt-1">
            Connect your wallet to manage your subscription.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foam">Subscription Plans</h1>
          <p className="text-ghost text-sm mt-1">
            Own Shards, unlock features, and earn income as a Keeper.
          </p>
        </div>
        {subscription.stripeCustomerId && (
          <Button variant="outline" size="sm" onClick={handleManage}>
            Manage Billing
          </Button>
        )}
      </div>

      {/* Message usage for Trainer+ */}
      {subscription.tier === "trainer_plus" &&
        subscription.messageCap &&
        subscription.messageCap > 0 && (
          <Card className="border-current/20">
            <CardContent className="py-3 flex items-center justify-between">
              <span className="text-sm text-ghost">
                Messages this month:{" "}
                <span className="text-foam font-medium">
                  {subscription.messageCount ?? 0}
                </span>
                {" / "}
                {subscription.messageCap.toLocaleString()}
              </span>
              <div className="w-48 h-2 bg-midnight rounded-full overflow-hidden">
                <div
                  className="h-full bg-siphon-teal rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      ((subscription.messageCount ?? 0) /
                        subscription.messageCap) *
                        100
                    )}%`,
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

      {loading ? (
        <div className="text-ghost text-sm animate-pulse">
          Loading subscription...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {displayTiers.map((tierKey, idx) => {
            const tier = TIER_PRICES[tierKey];
            const isCurrent = subscription.tier === tierKey;
            const isDowngrade = idx < currentTierIdx;
            const isUpgrade = idx > currentTierIdx;
            const hasStake = tier.stakeAlternative > 0;

            return (
              <Card
                key={tierKey}
                className={`relative transition-all ${
                  isCurrent
                    ? `ring-2 ring-siphon-teal/50 ${TIER_BORDER_COLORS[tierKey]}`
                    : TIER_BORDER_COLORS[tierKey]
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="default">Current Plan</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <div className={`mx-auto mb-2 ${TIER_COLORS[tierKey]}`}>
                    {TIER_ICONS[tierKey]}
                  </div>
                  <CardTitle className="text-lg">{tier.name}</CardTitle>
                  <div className="mt-2">
                    {tier.price === 0 ? (
                      <span className="text-3xl font-bold text-foam">Free</span>
                    ) : tier.price === -1 ? (
                      <span className="text-xl font-bold text-foam">
                        Custom
                      </span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-foam">
                          ${(tier.price / 100).toFixed(2)}
                        </span>
                        <span className="text-ghost text-sm">/mo</span>
                      </>
                    )}
                  </div>
                  {hasStake && (
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Coins className="h-3 w-3 text-ember" />
                      <span className="text-xs text-ember">
                        or {tier.stakeAlternative} USDC stake
                      </span>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {tier.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-2 text-sm text-ghost"
                      >
                        <Check className="h-4 w-4 text-siphon-teal shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : tierKey === "free_trainer" ? (
                    <Button
                      variant="ghost"
                      className="w-full"
                      disabled={isDowngrade}
                    >
                      {isDowngrade ? "Downgrade via billing" : "Free"}
                    </Button>
                  ) : tier.priceId ? (
                    <Button
                      variant={isUpgrade ? "default" : "outline"}
                      className="w-full"
                      onClick={() => handleUpgrade(tierKey)}
                      disabled={!!checkoutLoading || isDowngrade}
                    >
                      {checkoutLoading === tierKey
                        ? "Redirecting..."
                        : isDowngrade
                          ? "Downgrade via billing"
                          : "Upgrade"}
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      Contact Us
                    </Button>
                  )}

                  {/* USDC Stake alternative */}
                  {hasStake && !isCurrent && isUpgrade && (
                    <Button
                      variant="outline"
                      className="w-full mt-2"
                      onClick={() => handleStake(tierKey)}
                      disabled={!!stakingLoading}
                    >
                      {stakingLoading === tierKey ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Staking...
                        </>
                      ) : (
                        <>
                          <Coins className="h-4 w-4 mr-2" />
                          Stake {tier.stakeAlternative} USDC
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {subscription.currentPeriodEnd && (
        <p className="text-ghost text-xs text-center">
          Current period ends:{" "}
          {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
        </p>
      )}

      <div className="text-center text-ghost text-xs mt-4">
        Identity upkeep: ~$1/shard/month. Active and Shelter-listed Shards get
        50-100% discount.
      </div>
    </div>
  );
}
