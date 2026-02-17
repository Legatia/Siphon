import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM cosmetics WHERE id = ?")
    .get(params.id) as Record<string, unknown> | undefined;

  if (!row) {
    return NextResponse.json(
      { error: "Cosmetic not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: row.id,
    name: row.name,
    slot: row.slot,
    rarity: row.rarity,
    description: row.description,
    previewData: row.preview_data,
    price: row.price,
    creatorId: row.creator_id,
    createdAt: row.created_at,
  });
}
