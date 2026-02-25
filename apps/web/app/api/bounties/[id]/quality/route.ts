import { NextRequest, NextResponse } from "next/server";
import { requireSessionAddress } from "@/lib/session-auth";
import { dbGet } from "@/lib/db";
import { evaluateBountyQuality } from "@/lib/bounty-quality";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSessionAddress();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const bounty = await dbGet<{
    poster: string;
    claimant?: string | null;
    execution_result?: string | null;
    state: string;
  }>("SELECT * FROM bounties WHERE id = ?", id);

  if (!bounty) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }

  const me = auth.address.toLowerCase();
  const isParticipant =
    bounty.poster.toLowerCase() === me || bounty.claimant?.toLowerCase() === me;

  if (!isParticipant) {
    return NextResponse.json(
      { error: "Only bounty participants can inspect quality details" },
      { status: 403 }
    );
  }

  if (!bounty.execution_result) {
    return NextResponse.json(
      { error: "No execution output available for quality analysis" },
      { status: 400 }
    );
  }

  const quality = evaluateBountyQuality(bounty.execution_result);
  return NextResponse.json({ bountyId: id, state: bounty.state, quality });
}
