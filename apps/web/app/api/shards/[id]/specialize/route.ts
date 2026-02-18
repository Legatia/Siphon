import { NextRequest, NextResponse } from "next/server";
import { getShardById } from "@/lib/shard-engine";
import { getDb } from "@/lib/db";
import {
  PROTOCOL_CONSTANTS,
  SPECIALIZATION_BRANCHES,
  Specialization,
} from "@siphon/core";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { branch } = body;

    // Validate branch input
    if (branch !== 0 && branch !== 1) {
      return NextResponse.json(
        { error: "Branch must be 0 or 1" },
        { status: 400 }
      );
    }

    const shard = getShardById(id);
    if (!shard) {
      return NextResponse.json(
        { error: "Shard not found" },
        { status: 404 }
      );
    }

    // Validate level requirement
    if (shard.level < PROTOCOL_CONSTANTS.SPECIALIZATION_LEVEL) {
      return NextResponse.json(
        {
          error: `Shard must be level ${PROTOCOL_CONSTANTS.SPECIALIZATION_LEVEL} or higher to specialize (currently level ${shard.level})`,
        },
        { status: 400 }
      );
    }

    // Validate shard hasn't already specialized
    if (shard.specialization !== Specialization.None) {
      return NextResponse.json(
        {
          error: `Shard has already specialized as ${shard.specialization}`,
        },
        { status: 400 }
      );
    }

    // Get the available branches for this shard type
    const branches = SPECIALIZATION_BRANCHES[shard.type];
    if (!branches) {
      return NextResponse.json(
        { error: "No specialization branches available for this shard type" },
        { status: 400 }
      );
    }

    const specialization = branches[branch];

    // Update the shard's specialization in the database
    const db = getDb();
    db.prepare("UPDATE shards SET specialization = ? WHERE id = ?").run(
      specialization,
      shard.id
    );

    const updatedShard = { ...shard, specialization };

    return NextResponse.json(updatedShard);
  } catch (error) {
    console.error("Specialization error:", error);
    return NextResponse.json(
      { error: "Failed to specialize shard" },
      { status: 500 }
    );
  }
}
