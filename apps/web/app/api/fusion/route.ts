import { NextRequest, NextResponse } from "next/server";
import { getShardById } from "@/lib/shard-engine";
import { getDb, shardToRow } from "@/lib/db";
import { canFuse, performFusion } from "@siphon/core";
import { getUserSubscription } from "@/lib/subscription-check";
import { tierMeetsRequirement } from "@/lib/stripe";
import { ensureAddressMatch, requireSessionAddress } from "@/lib/session-auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { shardIdA, shardIdB, ownerId } = body;

    if (!shardIdA || !shardIdB || !ownerId) {
      return NextResponse.json(
        { error: "Missing required fields: shardIdA, shardIdB, ownerId" },
        { status: 400 }
      );
    }

    const mismatch = ensureAddressMatch(auth.address, ownerId, "ownerId");
    if (mismatch) return mismatch;

    // Fetch both shards
    const shardA = await getShardById(shardIdA);
    if (!shardA) {
      return NextResponse.json(
        { error: `Shard A not found: ${shardIdA}` },
        { status: 404 }
      );
    }

    const shardB = await getShardById(shardIdB);
    if (!shardB) {
      return NextResponse.json(
        { error: `Shard B not found: ${shardIdB}` },
        { status: 404 }
      );
    }

    // Verify ownership
    if (shardA.ownerId !== ownerId || shardB.ownerId !== ownerId) {
      return NextResponse.json(
        { error: "Both shards must be owned by the requesting user" },
        { status: 403 }
      );
    }

    // Fusion requires Keeper tier or higher
    const sub = await getUserSubscription(ownerId);
    if (!tierMeetsRequirement(sub.tier, "keeper")) {
      return NextResponse.json(
        { error: "Fusion requires Keeper tier or higher" },
        { status: 403 }
      );
    }

    // Check fusion compatibility
    const fusionCheck = canFuse(shardA, shardB);
    if (!fusionCheck.canFuse) {
      return NextResponse.json(
        { error: fusionCheck.reason || "Shards cannot be fused" },
        { status: 400 }
      );
    }

    // Perform the fusion
    const fusedShard = performFusion(shardA, shardB);

    const row = shardToRow(fusedShard);
    const client = await getDb();

    // Use a batch for atomicity: insert new shard and consume parents
    await client.batch(
      [
        {
          sql: `INSERT INTO shards (id, genome_hash, type, species, name, level, xp, owner_id, is_wild, avatar_json, specialization, personality, stats_json, created_at, last_interaction, decay_factor, last_decay_check, fused_from_json, cosmetic_slots_json, token_id, elo_rating)
                VALUES (:id, :genome_hash, :type, :species, :name, :level, :xp, :owner_id, :is_wild, :avatar_json, :specialization, :personality, :stats_json, :created_at, :last_interaction, :decay_factor, :last_decay_check, :fused_from_json, :cosmetic_slots_json, :token_id, :elo_rating)`,
          args: row as any,
        },
        {
          sql: "UPDATE shards SET owner_id = NULL, is_wild = 0 WHERE id = ?",
          args: [shardA.id],
        },
        {
          sql: "UPDATE shards SET owner_id = NULL, is_wild = 0 WHERE id = ?",
          args: [shardB.id],
        },
      ],
      "write"
    );

    return NextResponse.json(fusedShard);
  } catch (error) {
    console.error("Fusion error:", error);
    return NextResponse.json(
      { error: "Fusion failed" },
      { status: 500 }
    );
  }
}
