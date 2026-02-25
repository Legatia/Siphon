import { NextRequest, NextResponse } from "next/server";
import { dbGet } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = await dbGet<Record<string, unknown>>(
    "SELECT * FROM cosmetics WHERE id = ?",
    id
  );

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
