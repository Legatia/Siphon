import { NextRequest, NextResponse } from "next/server";
import { getShardById, releaseToWild } from "@/lib/shard-engine";
import { ensureAddressMatch, requireSessionAddress } from "@/lib/session-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const shard = await getShardById(id);
  if (!shard) {
    return NextResponse.json({ error: "Shard not found" }, { status: 404 });
  }
  return NextResponse.json(shard);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireSessionAddress();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const { ownerId } = body;

  if (!ownerId) {
    return NextResponse.json({ error: "Missing ownerId" }, { status: 400 });
  }

  const mismatch = ensureAddressMatch(auth.address, ownerId, "ownerId");
  if (mismatch) return mismatch;

  const released = await releaseToWild(id, ownerId);
  if (!released) {
    return NextResponse.json({ error: "Cannot release shard" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
