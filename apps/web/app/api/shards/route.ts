import { NextRequest, NextResponse } from "next/server";
import { getOwnedShards, getAllShards } from "@/lib/shard-engine";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ownerId = searchParams.get("ownerId");

  if (ownerId) {
    const shards = getOwnedShards(ownerId);
    return NextResponse.json(shards);
  }

  const shards = getAllShards();
  return NextResponse.json(shards);
}
