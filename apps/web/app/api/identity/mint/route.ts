import { NextRequest, NextResponse } from "next/server";
import { dbRun } from "@/lib/db";
import { getShardById } from "@/lib/shard-engine";
import { ensureAddressMatch, requireSessionAddress } from "@/lib/session-auth";
import { ERC8004_IDENTITY_CONFIGURED } from "@/lib/contracts";
import { verifyIdentityTx } from "@/lib/identity-onchain";
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { shardId, ownerId, txHash, tokenId } = body;

    if (!shardId || !ownerId) {
      return NextResponse.json(
        { error: "Missing shardId or ownerId" },
        { status: 400 }
      );
    }

    const mismatch = ensureAddressMatch(auth.address, ownerId, "ownerId");
    if (mismatch) return mismatch;

    const shard = await getShardById(shardId);
    if (!shard) {
      return NextResponse.json(
        { error: "Shard not found" },
        { status: 404 }
      );
    }

    if (shard.ownerId !== ownerId) {
      return NextResponse.json(
        { error: "Shard does not belong to this owner" },
        { status: 403 }
      );
    }

    if (shard.tokenId) {
      return NextResponse.json(
        { error: "Shard already has a minted identity token", tokenId: shard.tokenId },
        { status: 409 }
      );
    }

    // Two-phase flow:
    // Phase 1: No txHash → return genome hash for client to mint on-chain
    // Phase 2: txHash + tokenId → store the real on-chain tokenId

    if (!txHash) {
      if (!ERC8004_IDENTITY_CONFIGURED) {
        return NextResponse.json(
          { error: "ERC8004 identity contract is not configured" },
          { status: 503 }
        );
      }

      // Phase 1: Prepare mint data — use the shard's actual genomeHash from DB
      // so it matches what's stored in ShardRegistry on-chain
      const genomeHash = shard.genomeHash;

      return NextResponse.json(
        {
          needsOnChainMint: true,
          genomeHash,
          shardId,
          contractCall: {
            functionName: "mintAgent",
            args: [genomeHash],
          },
        },
        { status: 202 }
      );
    }

    // Phase 2: Confirm on-chain mint
    if (!tokenId) {
      return NextResponse.json(
        { error: "tokenId is required when confirming mint with txHash" },
        { status: 400 }
      );
    }

    const verified = await verifyIdentityTx(txHash, auth.address as `0x${string}`);
    if (!verified.ok) {
      return NextResponse.json(
        { error: verified.error },
        { status: 400 }
      );
    }

    await dbRun("UPDATE shards SET token_id = ? WHERE id = ?", tokenId, shardId);

    const updated = await getShardById(shardId);

    return NextResponse.json({ tokenId, txHash, shard: updated });
  } catch (err) {
    console.error("[identity/mint] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
