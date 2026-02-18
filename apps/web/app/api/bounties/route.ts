import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * GET /api/bounties — List bounties with optional state filter
 * POST /api/bounties — Record a new bounty (after on-chain postBounty)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state");

  try {
    const db = getDb();

    let bounties;
    if (state) {
      bounties = db
        .prepare("SELECT * FROM bounties WHERE state = ? ORDER BY created_at DESC")
        .all(state);
    } else {
      bounties = db
        .prepare("SELECT * FROM bounties ORDER BY created_at DESC")
        .all();
    }

    return NextResponse.json(bounties);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch bounties" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { poster, reward, description, deadline, txHash, bountyIdHex } = body;

    if (!poster || !reward || !description || !deadline || !txHash || !bountyIdHex) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = getDb();

    const id = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`
      INSERT INTO bounties (id, bounty_id_hex, poster, reward, description, deadline, state, tx_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'Open', ?, ?)
    `).run(id, bountyIdHex, poster, reward, description, deadline, txHash, now);

    return NextResponse.json({ id, bountyIdHex, poster, reward, description, deadline, state: "Open" }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create bounty";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/bounties — Update bounty state (claim/complete/dispute/cancel)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { bountyId, action, caller, shardOrSwarmId } = body;

    if (!bountyId || !action) {
      return NextResponse.json(
        { error: "Missing bountyId or action" },
        { status: 400 }
      );
    }

    const db = getDb();
    const bounty = db
      .prepare("SELECT * FROM bounties WHERE id = ?")
      .get(bountyId) as BountyRow | undefined;

    if (!bounty) {
      return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
    }

    switch (action) {
      case "claim": {
        if (bounty.state !== "Open") {
          return NextResponse.json({ error: "Bounty is not open" }, { status: 400 });
        }
        db.prepare("UPDATE bounties SET state = 'Claimed', claimant = ?, shard_or_swarm_id = ? WHERE id = ?")
          .run(caller, shardOrSwarmId ?? null, bountyId);
        break;
      }
      case "complete": {
        if (bounty.state !== "Claimed") {
          return NextResponse.json({ error: "Bounty is not claimed" }, { status: 400 });
        }
        if (!caller || caller.toLowerCase() !== bounty.poster.toLowerCase()) {
          return NextResponse.json({ error: "Only the poster can complete a bounty" }, { status: 403 });
        }
        db.prepare("UPDATE bounties SET state = 'Completed' WHERE id = ?").run(bountyId);
        break;
      }
      case "dispute": {
        if (bounty.state !== "Claimed") {
          return NextResponse.json({ error: "Bounty is not claimed" }, { status: 400 });
        }
        if (!caller || (caller.toLowerCase() !== bounty.poster.toLowerCase() && caller.toLowerCase() !== bounty.claimant?.toLowerCase())) {
          return NextResponse.json({ error: "Only the poster or claimant can dispute" }, { status: 403 });
        }
        db.prepare("UPDATE bounties SET state = 'Disputed' WHERE id = ?").run(bountyId);
        break;
      }
      case "cancel": {
        if (bounty.state !== "Open") {
          return NextResponse.json({ error: "Can only cancel open bounties" }, { status: 400 });
        }
        if (!caller || caller.toLowerCase() !== bounty.poster.toLowerCase()) {
          return NextResponse.json({ error: "Only the poster can cancel" }, { status: 403 });
        }
        db.prepare("UPDATE bounties SET state = 'Cancelled' WHERE id = ?").run(bountyId);
        break;
      }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const updated = db.prepare("SELECT * FROM bounties WHERE id = ?").get(bountyId);
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update bounty";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface BountyRow {
  id: string;
  bounty_id_hex: string;
  poster: string;
  claimant?: string;
  shard_or_swarm_id?: string;
  reward: string;
  description: string;
  deadline: number;
  state: string;
  tx_hash?: string;
  created_at: number;
}
