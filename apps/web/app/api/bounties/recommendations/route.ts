import { NextRequest, NextResponse } from "next/server";
import { requireSessionAddress } from "@/lib/session-auth";
import { getOwnedShards } from "@/lib/shard-engine";
import { dbAll } from "@/lib/db";
import { rankShardsForBounty } from "@/lib/bounty-matching";

export async function GET(request: NextRequest) {
  const auth = await requireSessionAddress();
  if ("error" in auth) return auth.error;

  const ownerId = auth.address;

  const openBounties = await dbAll<{
    id: string;
    poster: string;
    reward: string;
    description: string;
    deadline: number;
  }>(
    `SELECT id, poster, reward, description, deadline
     FROM bounties
     WHERE state = 'Open'
     ORDER BY created_at DESC
     LIMIT 100`
  );

  const shards = await getOwnedShards(ownerId);
  const recommendations = openBounties
    .filter((b) => b.poster.toLowerCase() !== ownerId)
    .map((b) => {
      const ranked = rankShardsForBounty(b.description, shards);
      return {
        bountyId: b.id,
        reward: b.reward,
        deadline: b.deadline,
        bestMatch: ranked[0] ?? null,
        alternatives: ranked.slice(1, 3),
      };
    })
    .filter((r) => r.bestMatch)
    .sort((a, b) => (b.bestMatch?.score ?? 0) - (a.bestMatch?.score ?? 0));

  return NextResponse.json(recommendations);
}
