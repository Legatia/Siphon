import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { TIER_PRICES } from "@/lib/stripe";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * POST: Record a USDC stake payment as subscription alternative.
 * The frontend should call this after the on-chain transaction confirms.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, tier, txHash, amount } = body;

    if (!userId || !tier || !txHash || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: userId, tier, txHash, amount" },
        { status: 400 }
      );
    }

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
