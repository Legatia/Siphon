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

    // Ensure table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS bounties (
        id TEXT PRIMARY KEY,
        bounty_id_hex TEXT NOT NULL,
        poster TEXT NOT NULL,
        claimant TEXT,
        shard_or_swarm_id TEXT,
        reward TEXT NOT NULL,
        description TEXT NOT NULL,
        deadline INTEGER NOT NULL,
        state TEXT NOT NULL DEFAULT 'Open',
        tx_hash TEXT,
        created_at INTEGER NOT NULL
      )
    `);

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

    // Ensure table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS bounties (
        id TEXT PRIMARY KEY,
        bounty_id_hex TEXT NOT NULL,
        poster TEXT NOT NULL,
        claimant TEXT,
        shard_or_swarm_id TEXT,
        reward TEXT NOT NULL,
        description TEXT NOT NULL,
        deadline INTEGER NOT NULL,
        state TEXT NOT NULL DEFAULT 'Open',
        tx_hash TEXT,
        created_at INTEGER NOT NULL
      )
    `);

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
