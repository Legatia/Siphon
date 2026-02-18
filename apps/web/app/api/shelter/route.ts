import { NextRequest, NextResponse } from "next/server";
import { getAllShards, getOwnedShards } from "@/lib/shard-engine";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get("type");
  const minLevel = parseInt(searchParams.get("minLevel") || "0");
  const maxLevel = parseInt(searchParams.get("maxLevel") || "100");
  const ownerId = searchParams.get("ownerId");

  let shards = ownerId ? getOwnedShards(ownerId) : getAllShards();

  if (typeFilter !== null && typeFilter !== "") {
    const typeNum = parseInt(typeFilter);
    shards = shards.filter((s) => s.type === typeNum);
  }

  shards = shards.filter((s) => s.level >= minLevel && s.level <= maxLevel);

  return NextResponse.json(shards);
}
