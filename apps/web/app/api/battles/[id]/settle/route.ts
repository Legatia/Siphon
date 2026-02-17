import { NextRequest, NextResponse } from "next/server";
import { completeBattle, getBattleById } from "@/lib/battle-engine";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const battle = getBattleById(params.id);
    if (!battle) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });
    }

    if (battle.status === "completed") {
      return NextResponse.json(
        { error: "Battle is already completed" },
        { status: 400 }
      );
    }

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

    const completed = await completeBattle(params.id);
    return NextResponse.json(completed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to settle battle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
