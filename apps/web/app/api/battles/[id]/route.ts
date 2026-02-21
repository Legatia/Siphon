import { NextRequest, NextResponse } from "next/server";
import { completeBattle, getBattleById } from "@/lib/battle-engine";
import { getDb } from "@/lib/db";
import { PROTOCOL_CONSTANTS, type Battle, type BattleRound } from "@siphon/core";
import { requireSessionAddress } from "@/lib/session-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    let battle = getBattleById(id);
    if (!battle) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 });
    }
    if (battle.status !== "completed") {
      const now = Date.now();
      let mutated = false;
      for (const round of battle.rounds) {
        if (!round.dueAt || now <= round.dueAt) continue;
        if (!round.challengerResponse) {
          round.challengerResponse = "[Timed out]";
          mutated = true;
        }
        if (!round.defenderResponse) {
          round.defenderResponse = "[Timed out]";
          mutated = true;
        }
      }
      if (mutated) {
        const db = getDb();
        db.prepare("UPDATE battles SET rounds_json = ? WHERE id = ?").run(
          JSON.stringify(battle.rounds),
          id
        );
        const allRoundsPlayed =
          battle.rounds.length >= PROTOCOL_CONSTANTS.BATTLE_ROUNDS &&
          battle.rounds.every((r) => r.challengerResponse && r.defenderResponse);
        if (allRoundsPlayed) {
          battle = await completeBattle(id);
        }
      }
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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: battleId } = await params;
  try {
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { round, shardId, response, timedOut } = body;

    if (round === undefined || !shardId || response === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: round, shardId, response" },
        { status: 400 }
      );
    }

    const battle = getBattleById(battleId);
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
        startedAt: Date.now(),
        dueAt: Date.now() + PROTOCOL_CONSTANTS.BATTLE_TURN_TIME_LIMIT_MS,
      };
      battle.rounds.push(battleRound);
    }

    const challengerAddress = battle.challenger.keeperId.toLowerCase();
    const defenderAddress = battle.defender.keeperId.toLowerCase();
    const isParticipant =
      auth.address === challengerAddress || auth.address === defenderAddress;
    if (!isParticipant) {
      return NextResponse.json(
        { error: "Only battle participants can submit round responses" },
        { status: 403 }
      );
    }

    // Determine which participant this shard belongs to
    if (shardId === battle.challenger.shardId) {
      if (auth.address !== challengerAddress) {
        return NextResponse.json(
          { error: "Only the challenger can submit for this shard" },
          { status: 403 }
        );
      }
      battleRound.challengerResponse = timedOut ? "[Timed out]" : String(response);
    } else if (shardId === battle.defender.shardId) {
      if (auth.address !== defenderAddress) {
        return NextResponse.json(
          { error: "Only the defender can submit for this shard" },
          { status: 403 }
        );
      }
      battleRound.defenderResponse = timedOut ? "[Timed out]" : String(response);
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
      battleId
    );

    const allRoundsPlayed =
      battle.rounds.length >= PROTOCOL_CONSTANTS.BATTLE_ROUNDS &&
      battle.rounds.every((r) => r.challengerResponse && r.defenderResponse);

    if (allRoundsPlayed && battle.status !== "completed") {
      const completed = await completeBattle(battleId);
      return NextResponse.json(completed);
    }

    return NextResponse.json(battle);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update battle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
