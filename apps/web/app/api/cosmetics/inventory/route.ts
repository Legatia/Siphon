import { NextRequest, NextResponse } from "next/server";
import { dbAll } from "@/lib/db";
import { ensureAddressMatch, requireSessionAddress } from "@/lib/session-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSessionAddress();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const ownerId = searchParams.get("ownerId") ?? auth.address;
  const mismatch = ensureAddressMatch(auth.address, ownerId, "ownerId");
  if (mismatch) return mismatch;

  const rows = await dbAll<Record<string, unknown>>(
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
     ORDER BY ci.purchased_at DESC`,
    ownerId
  );

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
