import { NextRequest, NextResponse } from "next/server";
import { dbRun, dbGet } from "@/lib/db";
import type { CosmeticSlots } from "@siphon/core";
import { ensureAddressMatch, requireSessionAddress } from "@/lib/session-auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: shardId } = await params;
  try {
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { cosmeticSlots, ownerId } = body as {
      cosmeticSlots: CosmeticSlots;
      ownerId: string;
    };

    if (!cosmeticSlots || !ownerId) {
      return NextResponse.json(
        { error: "Missing required fields: cosmeticSlots, ownerId" },
        { status: 400 }
      );
    }

    const mismatch = ensureAddressMatch(auth.address, ownerId, "ownerId");
    if (mismatch) return mismatch;

    // Validate slot keys
    const validSlotKeys = ["aura", "trail", "crown", "emblem"];
    for (const key of Object.keys(cosmeticSlots)) {
      if (!validSlotKeys.includes(key)) {
        return NextResponse.json(
          { error: `Invalid slot key: ${key}` },
          { status: 400 }
        );
      }
    }

    // Verify shard exists and belongs to the user
    const shard = await dbGet<{ id: string; owner_id: string }>(
      "SELECT id, owner_id FROM shards WHERE id = ?",
      shardId
    );

    if (!shard) {
      return NextResponse.json(
        { error: "Shard not found" },
        { status: 404 }
      );
    }

    if (shard.owner_id !== ownerId) {
      return NextResponse.json(
        { error: "You do not own this shard" },
        { status: 403 }
      );
    }

    // Validate that each equipped cosmetic is owned by the user
    for (const [slot, cosmeticId] of Object.entries(cosmeticSlots)) {
      if (cosmeticId === null) continue;

      const owned = await dbGet<{ id: string }>(
        `SELECT ci.id FROM cosmetic_inventory ci
         JOIN cosmetics c ON ci.cosmetic_id = c.id
         WHERE ci.cosmetic_id = ? AND ci.owner_id = ? AND c.slot = ?`,
        cosmeticId, ownerId, slot
      );

      if (!owned) {
        return NextResponse.json(
          {
            error: `Cosmetic ${cosmeticId} not owned or wrong slot (${slot})`,
          },
          { status: 403 }
        );
      }
    }

    // Build the full slots object (ensure all 4 keys are present)
    const fullSlots: CosmeticSlots = {
      aura: cosmeticSlots.aura ?? null,
      trail: cosmeticSlots.trail ?? null,
      crown: cosmeticSlots.crown ?? null,
      emblem: cosmeticSlots.emblem ?? null,
    };

    await dbRun(
      "UPDATE shards SET cosmetic_slots_json = ? WHERE id = ?",
      JSON.stringify(fullSlots), shardId
    );

    return NextResponse.json({
      success: true,
      cosmeticSlots: fullSlots,
    });
  } catch (error) {
    console.error("Equip cosmetics error:", error);
    return NextResponse.json(
      { error: "Failed to equip cosmetics" },
      { status: 500 }
    );
  }
}
