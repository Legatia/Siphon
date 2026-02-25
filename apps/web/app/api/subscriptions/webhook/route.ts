import { NextRequest, NextResponse } from "next/server";
import { getStripe, TIER_PRICES } from "@/lib/stripe";
import { dbGet, dbRun } from "@/lib/db";
import crypto from "crypto";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  const now = Date.now();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const tier = session.metadata?.tier;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (!userId || !tier) {
          console.error("Missing metadata on checkout session:", session.id);
          break;
        }

        // Retrieve subscription to get period end
        let periodEnd: number | null = null;
        if (subscriptionId) {
          const sub = await getStripe().subscriptions.retrieve(subscriptionId);
          periodEnd = sub.current_period_end * 1000;
        }

        // Upsert subscription record
        const existing = await dbGet<{ id: string }>(
          "SELECT id FROM subscriptions WHERE user_id = ?",
          userId
        );

        if (existing) {
          await dbRun(
            `UPDATE subscriptions
             SET tier = ?, stripe_customer_id = ?, stripe_subscription_id = ?,
                 current_period_end = ?, updated_at = ?
             WHERE user_id = ?`,
            tier, customerId ?? null, subscriptionId ?? null, periodEnd, now, userId
          );
        } else {
          await dbRun(
            `INSERT INTO subscriptions (id, user_id, tier, stripe_customer_id, stripe_subscription_id, current_period_end, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            crypto.randomUUID(), userId, tier, customerId ?? null, subscriptionId ?? null, periodEnd, now, now
          );
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;

        // Determine tier from price by matching against env-configured price IDs
        const priceId = subscription.items.data[0]?.price?.id;
        let tier = "free_trainer";
        for (const [tierKey, cfg] of Object.entries(TIER_PRICES)) {
          if (cfg.priceId && priceId === cfg.priceId) {
            tier = tierKey;
            break;
          }
        }

        const periodEnd = subscription.current_period_end * 1000;

        await dbRun(
          `UPDATE subscriptions
           SET tier = ?, current_period_end = ?, updated_at = ?
           WHERE stripe_customer_id = ?`,
          tier, periodEnd, now, customerId ?? null
        );
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;

        await dbRun(
          `UPDATE subscriptions
           SET tier = 'free_trainer', stripe_subscription_id = NULL,
               current_period_end = NULL, updated_at = ?
           WHERE stripe_customer_id = ?`,
          now, customerId ?? null
        );
        break;
      }

      default:
        // Unhandled event type
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
