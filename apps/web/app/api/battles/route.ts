import { NextRequest, NextResponse } from "next/server";
import { createBattle, getBattlesForOwner } from "@/lib/battle-engine";
import { getShardById } from "@/lib/shard-engine";
import { BattleMode } from "@siphon/core";
import { ensureAddressMatch, requireSessionAddress } from "@/lib/session-auth";
import { dbRun } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSessionAddress();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const ownerId = searchParams.get("ownerId") ?? auth.address;
  const mismatch = ensureAddressMatch(auth.address, ownerId, "ownerId");
  if (mismatch) return mismatch;

  try {
    const battles = await getBattlesForOwner(ownerId);
    return NextResponse.json(battles);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch battles" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const {
      challengerShardId,
      defenderShardId,
      mode,
      stakeAmount,
      challengerOwnerId,
      defenderOwnerId,
      escrowTxHash,
    } = body;

    if (!challengerShardId || !defenderShardId || !mode || !challengerOwnerId || !defenderOwnerId) {
      return NextResponse.json(
        { error: "Missing required fields: challengerShardId, defenderShardId, mode, challengerOwnerId, defenderOwnerId" },
        { status: 400 }
      );
    }

    const mismatch = ensureAddressMatch(auth.address, challengerOwnerId, "challengerOwnerId");
    if (mismatch) return mismatch;

    const challengerShard = await getShardById(challengerShardId);
    if (!challengerShard || challengerShard.ownerId?.toLowerCase() !== auth.address) {
      return NextResponse.json(
        { error: "Authenticated user does not own challenger shard" },
        { status: 403 }
      );
    }

    if (!Object.values(BattleMode).includes(mode)) {
      return NextResponse.json(
        { error: "Invalid battle mode" },
        { status: 400 }
      );
    }

    // Staked battles require an escrow tx hash
    const stake = stakeAmount ?? 0;
    if (stake > 0 && !escrowTxHash) {
      return NextResponse.json(
        { error: "escrowTxHash required for staked battles" },
        { status: 400 }
      );
    }
    if (stake > 0 && !process.env.ARBITER_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "Staked battles are temporarily unavailable: ARBITER_PRIVATE_KEY is not configured" },
        { status: 503 }
      );
    }

    const battle = await createBattle(
      challengerShardId,
      defenderShardId,
      mode as BattleMode,
      stake,
      challengerOwnerId,
      defenderOwnerId
    );

    // Store escrow tx hash if provided
    if (escrowTxHash && stake > 0) {
      await dbRun(
        "UPDATE battles SET escrow_tx_hash = ? WHERE id = ?",
        escrowTxHash,
        battle.id
      );
      battle.escrowTxHash = escrowTxHash;
    }

    return NextResponse.json(battle, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create battle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
