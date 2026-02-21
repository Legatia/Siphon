import { NextRequest, NextResponse } from "next/server";
import { requireSessionAddress } from "@/lib/session-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/paymaster
 * Proxies ERC-4337 paymaster requests to Coinbase Developer Platform.
 * Keeps the CDP API key server-side — never exposed to the client.
 *
 * Required env: CDP_PAYMASTER_URL (from portal.cdp.coinbase.com → Paymaster)
 */
export async function POST(request: NextRequest) {
  const session = await requireSessionAddress();
  if ("error" in session) return session.error;

  const paymasterUrl = process.env.CDP_PAYMASTER_URL;

  if (!paymasterUrl) {
    return NextResponse.json(
      { error: "Paymaster not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();

    const response = await fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[paymaster] Proxy error:", error);
    return NextResponse.json(
      { error: "Paymaster request failed" },
      { status: 502 }
    );
  }
}
