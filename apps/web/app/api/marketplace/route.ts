import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbGet, dbRun } from "@/lib/db";
import crypto from "crypto";
import { ensureAddressMatch, requireSessionAddress } from "@/lib/session-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketplace — List active shard listings
 * POST /api/marketplace — Record a new listing (after on-chain listShard)
 * PATCH /api/marketplace — Update listing state (sold/cancelled)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const minPrice = Number(searchParams.get("minPrice") ?? "0");
  const maxPriceRaw = searchParams.get("maxPrice");
  const sort = searchParams.get("sort") ?? "newest";

  let listings = await dbAll<any>(
    "SELECT * FROM marketplace_listings WHERE state = 'active' ORDER BY created_at DESC"
  );

  listings = await Promise.all(
    listings
      .filter((row) => {
        const price = Number(row.price);
        if (Number.isFinite(minPrice) && price < minPrice) return false;
        if (maxPriceRaw !== null && maxPriceRaw !== "" && price > Number(maxPriceRaw)) return false;
        if (!q) return true;
        return (
          String(row.shard_name ?? "").toLowerCase().includes(q) ||
          String(row.shard_species ?? "").toLowerCase().includes(q)
        );
      })
      .map(async (row) => {
        const shard = await dbGet<{ level: number; elo_rating: number }>(
          "SELECT level, elo_rating FROM shards WHERE id = ?",
          row.shard_id
        );
        const level = shard?.level ?? 1;
        const elo = shard?.elo_rating ?? 1200;
        const estimatedValue = Number((0.005 + level * 0.0015 + Math.max(0, elo - 1200) * 0.00002).toFixed(4));
        return { ...row, level, elo, estimatedValue };
      })
  );

  listings.sort((a: any, b: any) => {
    if (sort === "price_asc") return Number(a.price) - Number(b.price);
    if (sort === "price_desc") return Number(b.price) - Number(a.price);
    if (sort === "value_desc") return b.estimatedValue - a.estimatedValue;
    return b.created_at - a.created_at;
  });

  return NextResponse.json(listings);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { shardId, seller, price, shardName, shardSpecies, txHash } = body;

    if (!shardId || !seller || !price) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const mismatch = ensureAddressMatch(auth.address, seller, "seller");
    if (mismatch) return mismatch;

    const id = crypto.randomUUID();

    await dbRun(
      `INSERT INTO marketplace_listings (id, shard_id, seller, price, shard_name, shard_species, state, tx_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      id, shardId, seller, price, shardName ?? null, shardSpecies ?? null, txHash ?? null, Date.now()
    );

    return NextResponse.json({ id, shardId, seller, price, state: "active" }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create listing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { shardId, state } = body;

    if (!shardId || !state) {
      return NextResponse.json({ error: "Missing shardId or state" }, { status: 400 });
    }

    if (!["sold", "cancelled"].includes(state)) {
      return NextResponse.json({ error: "State must be 'sold' or 'cancelled'" }, { status: 400 });
    }

    const listing = await dbGet<{ seller: string }>(
      "SELECT seller FROM marketplace_listings WHERE shard_id = ? AND state = 'active'",
      shardId
    );

    if (!listing) {
      return NextResponse.json({ error: "Active listing not found" }, { status: 404 });
    }

    if (state === "cancelled" && auth.address !== listing.seller.toLowerCase()) {
      return NextResponse.json({ error: "Only the seller can cancel this listing" }, { status: 403 });
    }

    await dbRun("UPDATE marketplace_listings SET state = ? WHERE shard_id = ? AND state = 'active'", state, shardId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update listing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
