import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketplace — List active shard listings
 * POST /api/marketplace — Record a new listing (after on-chain listShard)
 * PATCH /api/marketplace — Update listing state (sold/cancelled)
 */
export async function GET() {
  const db = getDb();

  const listings = db
    .prepare("SELECT * FROM marketplace_listings WHERE state = 'active' ORDER BY created_at DESC")
    .all();

  return NextResponse.json(listings);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shardId, seller, price, shardName, shardSpecies, txHash } = body;

    if (!shardId || !seller || !price) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = getDb();

    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO marketplace_listings (id, shard_id, seller, price, shard_name, shard_species, state, tx_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(id, shardId, seller, price, shardName ?? null, shardSpecies ?? null, txHash ?? null, Date.now());

    return NextResponse.json({ id, shardId, seller, price, state: "active" }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create listing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { shardId, state } = body;

    if (!shardId || !state) {
      return NextResponse.json({ error: "Missing shardId or state" }, { status: 400 });
    }

    if (!["sold", "cancelled"].includes(state)) {
      return NextResponse.json({ error: "State must be 'sold' or 'cancelled'" }, { status: 400 });
    }

    const db = getDb();
    db.prepare("UPDATE marketplace_listings SET state = ? WHERE shard_id = ? AND state = 'active'").run(state, shardId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update listing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
