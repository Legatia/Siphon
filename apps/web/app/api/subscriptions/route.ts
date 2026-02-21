import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getStripe, TIER_PRICES, getShardLimit, getMessageCap } from "@/lib/stripe";
import crypto from "crypto";
import { ensureAddressMatch, requireSessionAddress } from "@/lib/session-auth";

export const dynamic = "force-dynamic";

function getMonthStart(): number {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export async function GET(request: NextRequest) {
  const auth = await requireSessionAddress();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? auth.address;
  const mismatch = ensureAddressMatch(auth.address, userId, "userId");
  if (mismatch) return mismatch;

  const db = getDb();
  const row = db
    .prepare("SELECT * FROM subscriptions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1")
    .get(userId) as Record<string, unknown> | undefined;

  if (!row) {
    return NextResponse.json({
      tier: "free_trainer",
      shardLimit: 0,
      messageCap: -1,
      messageCount: 0,
      messagesRemaining: -1,
    });
  }

  const tier = row.tier as string;
  const messageCap = getMessageCap(tier);
  const messageCount = (row.message_count as number) ?? 0;

  // Reset message count if we're in a new month
  const lastReset = (row.last_message_reset as number) ?? 0;
  const monthStart = getMonthStart();
  let effectiveMessageCount = messageCount;
  if (lastReset < monthStart) {
    db.prepare(
      "UPDATE subscriptions SET message_count = 0, last_message_reset = ? WHERE user_id = ?"
    ).run(monthStart, userId);
    effectiveMessageCount = 0;
  }

  return NextResponse.json({
    id: row.id,
    userId: row.user_id,
    tier,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    currentPeriodEnd: row.current_period_end,
    shardLimit: getShardLimit(tier),
    messageCap,
    messageCount: effectiveMessageCount,
    messagesRemaining: messageCap === -1 ? -1 : Math.max(0, messageCap - effectiveMessageCount),
    stakeAmount: row.stake_amount,
    hostingType: row.hosting_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { tier, userId, returnUrl } = body;

    if (!tier || !userId || !returnUrl) {
      return NextResponse.json(
        { error: "Missing required fields: tier, userId, returnUrl" },
        { status: 400 }
      );
    }

    const mismatch = ensureAddressMatch(auth.address, userId, "userId");
    if (mismatch) return mismatch;

    const tierConfig = TIER_PRICES[tier];
    if (!tierConfig || !tierConfig.priceId) {
      return NextResponse.json(
        { error: "Invalid tier or tier cannot be purchased via Stripe" },
        { status: 400 }
      );
    }

    // Check for existing Stripe customer
    const db = getDb();
    const existing = db
      .prepare("SELECT stripe_customer_id FROM subscriptions WHERE user_id = ? AND stripe_customer_id IS NOT NULL LIMIT 1")
      .get(userId) as { stripe_customer_id: string } | undefined;

    let customerId = existing?.stripe_customer_id;

    // Create customer if none exists
    if (!customerId) {
      const customer = await getStripe().customers.create({
        metadata: { userId },
      });
      customerId = customer.id;
    }

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: tierConfig.priceId,
          quantity: 1,
        },
      ],
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: returnUrl,
      metadata: {
        userId,
        tier,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Subscription checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
