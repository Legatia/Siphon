import { NextRequest, NextResponse } from "next/server";
import { getAllShards, getOwnedShards } from "@/lib/shard-engine";
import { ensureAddressMatch, requireSessionAddress } from "@/lib/session-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get("type");
  const minLevel = parseInt(searchParams.get("minLevel") || "0");
  const maxLevel = parseInt(searchParams.get("maxLevel") || "100");
  const ownerId = searchParams.get("ownerId");

  if (ownerId) {
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;
    const mismatch = ensureAddressMatch(auth.address, ownerId, "ownerId");
    if (mismatch) return mismatch;
  }

  let shards = ownerId ? getOwnedShards(ownerId) : getAllShards();

  if (typeFilter !== null && typeFilter !== "") {
    const typeNum = parseInt(typeFilter);
    shards = shards.filter((s) => s.type === typeNum);
  }

  shards = shards.filter((s) => s.level >= minLevel && s.level <= maxLevel);

  return NextResponse.json(shards);
}
