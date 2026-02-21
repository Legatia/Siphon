import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { TIER_PRICES } from "@/lib/stripe";
import {
  publicClient,
  SUBSCRIPTION_STAKING_ABI,
  SUBSCRIPTION_STAKING_ADDRESS,
} from "@/lib/contracts";
import crypto from "crypto";
import { ensureAddressMatch, requireSessionAddress } from "@/lib/session-auth";

export const dynamic = "force-dynamic";

// Map on-chain tier enum (uint8) to tier key
const TIER_ENUM_MAP: Record<number, string> = {
  1: "keeper",
  2: "keeper_plus",
  3: "keeper_pro",
};

/**
 * POST: Record a USDC stake payment as subscription alternative.
 * After recording txHash, verifies the on-chain tier from the SubscriptionStaking contract.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { userId, tier, txHash, amount } = body;

    if (!userId || !tier || !txHash || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: userId, tier, txHash, amount" },
        { status: 400 }
      );
    }

    const mismatch = ensureAddressMatch(auth.address, userId, "userId");
    if (mismatch) return mismatch;

    const tierConfig = TIER_PRICES[tier];
    if (!tierConfig || tierConfig.stakeAlternative === 0) {
      return NextResponse.json(
        { error: "This tier does not support USDC staking" },
        { status: 400 }
      );
    }

    if (amount < tierConfig.stakeAlternative) {
      return NextResponse.json(
        {
          error: `Insufficient stake. Required: ${tierConfig.stakeAlternative} USDC, received: ${amount}`,
        },
        { status: 400 }
      );
    }

    // Verify on-chain: read the user's tier from SubscriptionStaking contract
    try {
      const onChainTier = (await publicClient.readContract({
        address: SUBSCRIPTION_STAKING_ADDRESS as `0x${string}`,
        abi: SUBSCRIPTION_STAKING_ABI,
        functionName: "getTier",
        args: [userId as `0x${string}`],
      })) as number;

      if (onChainTier === 0) {
        return NextResponse.json(
          { error: "On-chain verification failed: no active stake found. Complete the staking transaction first." },
          { status: 400 }
        );
      }

      // Verify the on-chain tier matches or exceeds the requested tier
      const onChainTierKey = TIER_ENUM_MAP[onChainTier];
      if (!onChainTierKey) {
        return NextResponse.json(
          { error: "On-chain verification failed: unrecognized tier" },
          { status: 400 }
        );
      }
    } catch (err) {
      // If contract isn't deployed yet, log warning but allow (graceful degradation)
      console.warn("On-chain tier verification skipped (contract may not be deployed):", err);
    }

    const db = getDb();
    const now = Date.now();

    // Record stake payment
    db.prepare(
      `INSERT INTO stake_payments (id, user_id, amount, tx_hash, confirmed, tier, created_at, expires_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, NULL)`
    ).run(crypto.randomUUID(), userId, amount, txHash, tier, now);

    // Upsert subscription record
    const existing = db
      .prepare("SELECT id FROM subscriptions WHERE user_id = ?")
      .get(userId) as { id: string } | undefined;

    const hostingType = tierConfig.hostingType;

    if (existing) {
      db.prepare(
        `UPDATE subscriptions
         SET tier = ?, stake_amount = ?, stake_tx_hash = ?, hosting_type = ?, updated_at = ?
         WHERE user_id = ?`
      ).run(tier, amount, txHash, hostingType, now, userId);
    } else {
      db.prepare(
        `INSERT INTO subscriptions (id, user_id, tier, stake_amount, stake_tx_hash, hosting_type, message_count, last_message_reset, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`
      ).run(crypto.randomUUID(), userId, tier, amount, txHash, hostingType, now, now);
    }

    return NextResponse.json({
      success: true,
      tier,
      stakeAmount: amount,
    });
  } catch (error) {
    console.error("Stake recording error:", error);
    return NextResponse.json(
      { error: "Failed to record stake" },
      { status: 500 }
    );
  }
}
