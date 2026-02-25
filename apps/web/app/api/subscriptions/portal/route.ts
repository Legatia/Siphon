import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { dbGet } from "@/lib/db";
import { requireSessionAddress } from "@/lib/session-auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { returnUrl } = body;

    if (!returnUrl) {
      return NextResponse.json(
        { error: "Missing required field: returnUrl" },
        { status: 400 }
      );
    }

    const row = await dbGet<{ stripe_customer_id: string }>(
      "SELECT stripe_customer_id FROM subscriptions WHERE user_id = ? AND stripe_customer_id IS NOT NULL ORDER BY updated_at DESC LIMIT 1",
      auth.address
    );
    const customerId = row?.stripe_customer_id;
    if (!customerId) {
      return NextResponse.json(
        { error: "No billing customer found for this account" },
        { status: 404 }
      );
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Portal session error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
