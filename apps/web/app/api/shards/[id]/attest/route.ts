import { NextRequest, NextResponse } from "next/server";
import { getShardById } from "@/lib/shard-engine";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import {
  SHARD_VALUATION_ABI,
  SHARD_VALUATION_ADDRESS,
  idToBytes32,
} from "@/lib/contracts";
import { requireSessionAddress } from "@/lib/session-auth";

/**
 * POST /api/shards/[id]/attest
 * Server-side keeper attestation: reads shard stats from DB,
 * calls ShardValuation.attest() on-chain using ARBITER_PRIVATE_KEY.
 * This lets the web app attest shard values without a keeper node.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;

    const { id: shardId } = await params;

    const shard = await getShardById(shardId);
    if (!shard) {
      return NextResponse.json({ error: "Shard not found" }, { status: 404 });
    }

    if (shard.isWild) {
      return NextResponse.json(
        { error: "Cannot attest wild shards" },
        { status: 400 }
      );
    }

    if (!shard.ownerId || shard.ownerId.toLowerCase() !== auth.address) {
      return NextResponse.json(
        { error: "Only the shard owner can request attestation" },
        { status: 403 }
      );
    }

    const arbiterKey = process.env.ARBITER_PRIVATE_KEY;
    if (!arbiterKey) {
      return NextResponse.json(
        { error: "ARBITER_PRIVATE_KEY not configured" },
        { status: 500 }
      );
    }

    const account = privateKeyToAccount(arbiterKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(),
    });

    const shardIdBytes = idToBytes32(shardId);
    const stats = shard.stats;
    const statsSum =
      stats.intelligence +
      stats.creativity +
      stats.precision +
      stats.resilience +
      stats.charisma;

    const hash = await walletClient.writeContract({
      address: SHARD_VALUATION_ADDRESS as `0x${string}`,
      abi: SHARD_VALUATION_ABI,
      functionName: "attest",
      args: [
        shardIdBytes,
        BigInt(shard.level),
        BigInt(shard.eloRating ?? 1200),
        BigInt(statsSum),
      ],
    });

    return NextResponse.json({
      txHash: hash,
      shardId,
      level: shard.level,
      elo: shard.eloRating ?? 1200,
      statsSum,
    });
  } catch (err) {
    console.error("[attest] Error:", err);
    const message = err instanceof Error ? err.message : "Attestation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
