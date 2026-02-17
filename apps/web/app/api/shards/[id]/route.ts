import { NextRequest, NextResponse } from "next/server";
import { getShardById, releaseToWild } from "@/lib/shard-engine";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const shard = getShardById(params.id);
  if (!shard) {
    return NextResponse.json({ error: "Shard not found" }, { status: 404 });
  }
  return NextResponse.json(shard);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { ownerId } = body;

  if (!ownerId) {
    return NextResponse.json({ error: "Missing ownerId" }, { status: 400 });
  }

  const released = releaseToWild(params.id, ownerId);
  if (!released) {
    return NextResponse.json({ error: "Cannot release shard" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
