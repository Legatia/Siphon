import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
      apiVersion: "2025-02-24.acacia",
    });
  }
  return _stripe;
}

/** @deprecated Use getStripe() instead */
export const stripe = undefined as unknown as Stripe;

export interface TierConfig {
  name: string;
  price: number; // cents/month (0 for free, -1 for custom)
  priceId: string; // Stripe price ID
  shardLimit: number; // max owned shards (-1 = unlimited)
  messageCap: number; // max messages/month (-1 = unlimited)
  hostingType: "none" | "platform" | "self";
  stakeAlternative: number; // USDC stake amount (0 = no stake option)
  features: string[];
}

export const TIER_PRICES: Record<string, TierConfig> = {
  free_trainer: {
    name: "Free Trainer",
    price: 0,
    priceId: "",
    shardLimit: 0,
    messageCap: -1,
    hostingType: "none",
    stakeAlternative: 0,
    features: [
      "Bond with Shards (rent)",
      "Train bonded Shards",
      "Battle access",
      "Drift exploration",
    ],
  },
  trainer_plus: {
    name: "Trainer+",
    price: 499,
    priceId: process.env.STRIPE_PRICE_TRAINER_PLUS || "",
    shardLimit: 3,
    messageCap: 1000,
    hostingType: "platform",
    stakeAlternative: 0,
    features: [
      "Own up to 3 Shards",
      "Platform-hosted inference",
      "1,000 messages/month",
      "Cosmetic slots",
      "Priority matchmaking",
    ],
  },
  keeper: {
    name: "Keeper",
    price: 999,
    priceId: process.env.STRIPE_PRICE_KEEPER || "",
    shardLimit: 10,
    messageCap: -1,
    hostingType: "self",
    stakeAlternative: 100,
    features: [
      "Own up to 10 Shards",
      "Self-hosted inference",
      "Unlimited messages",
      "Run keeper node",
      "Earn rental income",
      "Fusion access",
    ],
  },
  keeper_plus: {
    name: "Keeper+",
    price: 2999,
    priceId: process.env.STRIPE_PRICE_KEEPER_PLUS || "",
    shardLimit: 25,
    messageCap: -1,
    hostingType: "self",
    stakeAlternative: 500,
    features: [
      "Own up to 25 Shards",
      "Everything in Keeper",
      "Create & sell cosmetics",
      "API access",
      "Priority support",
    ],
  },
  keeper_pro: {
    name: "Keeper Pro",
    price: 9999,
    priceId: process.env.STRIPE_PRICE_KEEPER_PRO || "",
    shardLimit: 100,
    messageCap: -1,
    hostingType: "self",
    stakeAlternative: 2000,
    features: [
      "Own up to 100 Shards",
      "Everything in Keeper+",
      "Governance votes",
      "Bulk operations",
    ],
  },
  enterprise: {
    name: "Enterprise",
    price: -1,
    priceId: "",
    shardLimit: -1,
    messageCap: -1,
    hostingType: "self",
    stakeAlternative: 0,
    features: [
      "Unlimited Shards",
      "Custom pricing",
      "Dedicated support",
      "SLA guarantees",
    ],
  },
};

/** Tier hierarchy for comparison (higher index = higher tier) */
export const TIER_ORDER = [
  "free_trainer",
  "trainer_plus",
  "keeper",
  "keeper_plus",
  "keeper_pro",
  "enterprise",
] as const;

/** Returns true if userTier meets or exceeds requiredTier */
export function tierMeetsRequirement(
  userTier: string,
  requiredTier: string
): boolean {
  const userIdx = TIER_ORDER.indexOf(userTier as (typeof TIER_ORDER)[number]);
  const reqIdx = TIER_ORDER.indexOf(
    requiredTier as (typeof TIER_ORDER)[number]
  );
  if (userIdx === -1 || reqIdx === -1) return false;
  return userIdx >= reqIdx;
}

/** Get shard ownership limit for a tier */
export function getShardLimit(tier: string): number {
  return TIER_PRICES[tier]?.shardLimit ?? 0;
}

/** Get message cap for a tier (-1 = unlimited) */
export function getMessageCap(tier: string): number {
  return TIER_PRICES[tier]?.messageCap ?? -1;
}

/** Check if a tier allows shard ownership */
export function tierCanOwnShards(tier: string): boolean {
  return getShardLimit(tier) !== 0;
}
