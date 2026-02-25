import { NextRequest, NextResponse } from "next/server";
import { getOwnedShards, getAllShards } from "@/lib/shard-engine";
import { ensureAddressMatch, requireSessionAddress } from "@/lib/session-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ownerId = searchParams.get("ownerId");

  if (ownerId) {
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;
    const mismatch = ensureAddressMatch(auth.address, ownerId, "ownerId");
    if (mismatch) return mismatch;

    const shards = await getOwnedShards(ownerId);
    return NextResponse.json(shards);
  }

  const shards = await getAllShards();
  return NextResponse.json(shards);
}
