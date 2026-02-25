import { NextRequest, NextResponse } from "next/server";
import { requireSessionAddress } from "@/lib/session-auth";
import { getOperatorReputationBatch } from "@/lib/operator-reputation";

export async function POST(request: NextRequest) {
  const auth = await requireSessionAddress();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const addresses = Array.isArray(body?.addresses)
    ? body.addresses.filter((a: unknown) => typeof a === "string")
    : [];

  if (addresses.length === 0) {
    return NextResponse.json({ error: "addresses is required" }, { status: 400 });
  }

  const rows = await getOperatorReputationBatch(addresses);
  return NextResponse.json(rows);
}
