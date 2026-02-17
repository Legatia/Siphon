import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slot = searchParams.get("slot");
  const rarity = searchParams.get("rarity");

  const db = getDb();

  let query = "SELECT * FROM cosmetics WHERE 1=1";
  const params: unknown[] = [];

  if (slot) {
    query += " AND slot = ?";
    params.push(slot);
  }

  if (rarity) {
    query += " AND rarity = ?";
    params.push(rarity);
  }

  query += " ORDER BY created_at DESC";

  const rows = db.prepare(query).all(...params) as Record<string, unknown>[];

  const cosmetics = rows.map((row) => ({
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

  return NextResponse.json(cosmetics);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slot, rarity, description, previewData, price, creatorId } =
      body;

    if (!name || !slot || !description || !previewData) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: name, slot, description, previewData",
        },
        { status: 400 }
      );
    }

    if (!creatorId) {
      return NextResponse.json(
        { error: "Missing creatorId - Keeper Pro subscription required" },
        { status: 403 }
      );
    }

    const validSlots = ["aura", "trail", "crown", "emblem"];
    if (!validSlots.includes(slot)) {
      return NextResponse.json(
        { error: `Invalid slot. Must be one of: ${validSlots.join(", ")}` },
        { status: 400 }
      );
    }

    const validRarities = ["common", "rare", "epic", "legendary"];
    const cosmeticRarity = rarity || "common";
    if (!validRarities.includes(cosmeticRarity)) {
      return NextResponse.json(
        {
          error: `Invalid rarity. Must be one of: ${validRarities.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const db = getDb();
    const id = crypto.randomUUID();
    const now = Date.now();

    db.prepare(
      `INSERT INTO cosmetics (id, name, slot, rarity, description, preview_data, price, creator_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name, slot, cosmeticRarity, description, previewData, price || 0, creatorId, now);

    const cosmetic = {
      id,
      name,
      slot,
      rarity: cosmeticRarity,
      description,
      previewData,
      price: price || 0,
      creatorId,
      createdAt: now,
    };

    return NextResponse.json(cosmetic, { status: 201 });
  } catch (error) {
    console.error("Create cosmetic error:", error);
    return NextResponse.json(
      { error: "Failed to create cosmetic" },
      { status: 500 }
    );
  }
}
