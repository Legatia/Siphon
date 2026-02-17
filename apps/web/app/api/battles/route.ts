import { NextRequest, NextResponse } from "next/server";
import { createBattle, getBattlesForOwner } from "@/lib/battle-engine";
import { BattleMode } from "@siphon/core";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ownerId = searchParams.get("ownerId");

  if (!ownerId) {
    return NextResponse.json(
      { error: "ownerId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const battles = getBattlesForOwner(ownerId);
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

    const battle = createBattle(
      challengerShardId,
      defenderShardId,
      mode as BattleMode,
      stake,
      challengerOwnerId,
      defenderOwnerId
    );

    // Store escrow tx hash if provided
    if (escrowTxHash && stake > 0) {
      const { getDb } = await import("@/lib/db");
      const db = getDb();
      db.prepare("UPDATE battles SET escrow_tx_hash = ? WHERE id = ?").run(
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
