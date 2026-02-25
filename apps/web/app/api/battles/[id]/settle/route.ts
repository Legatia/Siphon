import { NextRequest, NextResponse } from "next/server";
import { completeBattle, getBattleById, syncBattleOnChainSettlement } from "@/lib/battle-engine";
import { requireSessionAddress } from "@/lib/session-auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;

    const battle = await getBattleById(id);
    if (!battle) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });
    }

    const isParticipant =
      auth.address === battle.challenger.keeperId.toLowerCase() ||
      auth.address === battle.defender.keeperId.toLowerCase();
    if (!isParticipant) {
      return NextResponse.json(
        { error: "Only battle participants can settle this battle" },
        { status: 403 }
      );
    }

    let result = battle;
    if (battle.status !== "completed") {
      // Check that there are rounds with responses to judge
      const hasResponses = battle.rounds.some(
        (r) => r.challengerResponse && r.defenderResponse
      );
      if (!hasResponses && battle.rounds.length === 0) {
        return NextResponse.json(
          { error: "No rounds have been played yet" },
          { status: 400 }
        );
      }
      result = await completeBattle(id);
    }

    const synced = await syncBattleOnChainSettlement(id);
    return NextResponse.json(synced ?? result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to settle battle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
