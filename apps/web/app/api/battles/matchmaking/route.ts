import { NextRequest, NextResponse } from "next/server";
import { joinQueue, leaveQueue, getQueueEntries } from "@/lib/battle-engine";
import { getShardById } from "@/lib/shard-engine";
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
    const entries = getQueueEntries(ownerId);
    return NextResponse.json(entries);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch queue status" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shardId, ownerId, mode, stakeAmount } = body;

    if (!shardId || !ownerId || !mode) {
      return NextResponse.json(
        { error: "Missing required fields: shardId, ownerId, mode" },
        { status: 400 }
      );
    }

    if (!Object.values(BattleMode).includes(mode)) {
      return NextResponse.json(
        { error: "Invalid battle mode" },
        { status: 400 }
      );
    }

    const shard = getShardById(shardId);
    if (!shard) {
      return NextResponse.json(
        { error: "Shard not found" },
        { status: 404 }
      );
    }

    if (shard.ownerId !== ownerId) {
      return NextResponse.json(
        { error: "You do not own this shard" },
        { status: 403 }
      );
    }

    const entry = joinQueue(
      shardId,
      ownerId,
      mode as BattleMode,
      shard.eloRating,
      stakeAmount ?? 0
    );

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to join queue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { entryId } = body;

    if (!entryId) {
      return NextResponse.json(
        { error: "Missing required field: entryId" },
        { status: 400 }
      );
    }

    leaveQueue(entryId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to leave queue" },
      { status: 500 }
    );
  }
}
