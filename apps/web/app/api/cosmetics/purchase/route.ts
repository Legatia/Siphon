import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import crypto from "crypto";
import { ensureAddressMatch, requireSessionAddress } from "@/lib/session-auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { cosmeticId, ownerId } = body;

    if (!cosmeticId || !ownerId) {
      return NextResponse.json(
        { error: "Missing required fields: cosmeticId, ownerId" },
        { status: 400 }
      );
    }

    const mismatch = ensureAddressMatch(auth.address, ownerId, "ownerId");
    if (mismatch) return mismatch;

    const db = getDb();

    // Verify cosmetic exists
    const cosmetic = db
      .prepare("SELECT id, name FROM cosmetics WHERE id = ?")
      .get(cosmeticId) as { id: string; name: string } | undefined;

    if (!cosmetic) {
      return NextResponse.json(
        { error: "Cosmetic not found" },
        { status: 404 }
      );
    }

    // Check if already owned
    const existing = db
      .prepare(
        "SELECT id FROM cosmetic_inventory WHERE cosmetic_id = ? AND owner_id = ?"
      )
      .get(cosmeticId, ownerId) as { id: string } | undefined;

    if (existing) {
      return NextResponse.json(
        { error: "Cosmetic already owned" },
        { status: 409 }
      );
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    db.prepare(
      `INSERT INTO cosmetic_inventory (id, cosmetic_id, owner_id, purchased_at)
       VALUES (?, ?, ?, ?)`
    ).run(id, cosmeticId, ownerId, now);

    return NextResponse.json({
      success: true,
      inventoryId: id,
      cosmeticId,
      ownerId,
      purchasedAt: now,
    });
  } catch (error) {
    console.error("Purchase cosmetic error:", error);
    return NextResponse.json(
      { error: "Failed to purchase cosmetic" },
      { status: 500 }
    );
  }
}
