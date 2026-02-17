import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ownerId = searchParams.get("ownerId");

  if (!ownerId) {
    return NextResponse.json(
      { error: "Missing ownerId query parameter" },
      { status: 400 }
    );
  }

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         ci.id AS inventory_id,
         ci.purchased_at,
         c.id,
         c.name,
         c.slot,
         c.rarity,
         c.description,
         c.preview_data,
         c.price,
         c.creator_id,
         c.created_at
       FROM cosmetic_inventory ci
       JOIN cosmetics c ON ci.cosmetic_id = c.id
       WHERE ci.owner_id = ?
       ORDER BY ci.purchased_at DESC`
    )
    .all(ownerId) as Record<string, unknown>[];

  const inventory = rows.map((row) => ({
    inventoryId: row.inventory_id,
    purchasedAt: row.purchased_at,
    id: row.id,
    name: row.name,
    slot: row.slot,
    rarity: row.rarity,
    description: row.description,
    previewData: row.preview_data,
    price: row.price,
    creatorId: row.creator_id,
    createdAt: row.created_at,
  }));

  return NextResponse.json(inventory);
}
