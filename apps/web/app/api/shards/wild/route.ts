import { NextResponse } from "next/server";
import { ensureWildShards } from "@/lib/shard-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  const shards = await ensureWildShards(8);
  // Add drift positions for the map
  const wildShards = shards.map((shard, i) => ({
    ...shard,
    driftPosition: {
      x: Math.sin(i * 2.4 + parseInt(shard.genomeHash.slice(2, 4), 16)) * 40 + 50,
      y: Math.cos(i * 1.7 + parseInt(shard.genomeHash.slice(4, 6), 16)) * 40 + 50,
      vx: (parseInt(shard.genomeHash.slice(6, 8), 16) / 255 - 0.5) * 0.5,
      vy: (parseInt(shard.genomeHash.slice(8, 10), 16) / 255 - 0.5) * 0.5,
    },
    spawnedAt: shard.createdAt,
  }));

  return NextResponse.json(wildShards);
}
