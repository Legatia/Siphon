import { NextRequest, NextResponse } from "next/server";
import { joinQueue, leaveQueueForOwner, getQueueEntries, attemptQueueMatches } from "@/lib/battle-engine";
import { getShardById } from "@/lib/shard-engine";
import { BattleMode } from "@siphon/core";
import { ensureAddressMatch, requireSessionAddress } from "@/lib/session-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSessionAddress();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const ownerId = searchParams.get("ownerId") ?? auth.address;
  const mismatch = ensureAddressMatch(auth.address, ownerId, "ownerId");
  if (mismatch) return mismatch;

  try {
    await attemptQueueMatches();
    const entries = await getQueueEntries(ownerId);
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
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { shardId, ownerId, mode, stakeAmount } = body;

    if (!shardId || !ownerId || !mode) {
      return NextResponse.json(
        { error: "Missing required fields: shardId, ownerId, mode" },
        { status: 400 }
      );
    }

    const mismatch = ensureAddressMatch(auth.address, ownerId, "ownerId");
    if (mismatch) return mismatch;

    if (!Object.values(BattleMode).includes(mode)) {
      return NextResponse.json(
        { error: "Invalid battle mode" },
        { status: 400 }
      );
    }

    const shard = await getShardById(shardId);
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

    const entry = await joinQueue(
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
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { entryId } = body;

    if (!entryId) {
      return NextResponse.json(
        { error: "Missing required field: entryId" },
        { status: 400 }
      );
    }

    const removed = await leaveQueueForOwner(entryId, auth.address);
    if (!removed) {
      return NextResponse.json(
        { error: "Queue entry not found or not owned by current user" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to leave queue" },
      { status: 500 }
    );
  }
}
