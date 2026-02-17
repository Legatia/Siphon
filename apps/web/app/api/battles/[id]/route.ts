import { NextRequest, NextResponse } from "next/server";
import { getBattleById } from "@/lib/battle-engine";
import { getDb } from "@/lib/db";
import type { Battle, BattleRound } from "@siphon/core";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const battle = getBattleById(params.id);
    if (!battle) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });
    }
    return NextResponse.json(battle);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch battle" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { round, shardId, response } = body;

    if (round === undefined || !shardId || !response) {
      return NextResponse.json(
        { error: "Missing required fields: round, shardId, response" },
        { status: 400 }
      );
    }

    const battle = getBattleById(params.id);
    if (!battle) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });
    }

    // Find or create the round
    let battleRound = battle.rounds.find(
      (r: BattleRound) => r.roundNumber === round
    );

    if (!battleRound) {
      // Import and generate the prompt for this round
      const { generateBattlePrompt } = await import("@siphon/core");
      battleRound = {
        roundNumber: round,
        prompt: generateBattlePrompt(battle.mode, round),
        challengerResponse: "",
        defenderResponse: "",
        scores: { challenger: 0, defender: 0 },
      };
      battle.rounds.push(battleRound);
    }

    // Determine which participant this shard belongs to
    if (shardId === battle.challenger.shardId) {
      battleRound.challengerResponse = response;
    } else if (shardId === battle.defender.shardId) {
      battleRound.defenderResponse = response;
    } else {
      return NextResponse.json(
        { error: "Shard is not a participant in this battle" },
        { status: 400 }
      );
    }

    // If both responses are in, judge the round
    if (battleRound.challengerResponse && battleRound.defenderResponse) {
      const { judgeBattleRound } = await import("@/lib/battle-engine");
      const result = await judgeBattleRound(
        battle.mode,
        battleRound.prompt,
        battleRound.challengerResponse,
        battleRound.defenderResponse
      );
      battleRound.scores = result.scores;
      battleRound.reasoning = result.reasoning;
    }

    // Update the battle in the database
    const db = getDb();
    db.prepare("UPDATE battles SET rounds_json = ? WHERE id = ?").run(
      JSON.stringify(battle.rounds),
      params.id
    );

    return NextResponse.json(battle);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update battle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
