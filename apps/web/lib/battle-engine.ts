import { getDb } from "@/lib/db";
import { getShardById } from "@/lib/shard-engine";
import { generateBattleJudgment } from "@/lib/llm";
import {
  generateBattlePrompt,
  scoreBattleRound,
  calculateEloChange,
  determineBattleWinner,
  PROTOCOL_CONSTANTS,
  BattleMode,
  BattleStatus,
  type Battle,
  type BattleParticipant,
  type BattleRound,
  type MatchmakingEntry,
} from "@siphon/core";
import crypto from "crypto";

function battleToRow(battle: Battle) {
  return {
    id: battle.id,
    mode: battle.mode,
    status: battle.status,
    challenger_json: JSON.stringify(battle.challenger),
    defender_json: JSON.stringify(battle.defender),
    rounds_json: JSON.stringify(battle.rounds),
    winner_id: battle.winnerId,
    stake_amount: battle.stakeAmount,
    escrow_tx_hash: battle.escrowTxHash,
    settlement_tx_hash: battle.settlementTxHash,
    judge_model: battle.judgeModel,
    created_at: battle.createdAt,
    completed_at: battle.completedAt,
  };
}

function rowToBattle(row: any): Battle {
  return {
    id: row.id,
    mode: row.mode as BattleMode,
    status: row.status as BattleStatus,
    challenger: JSON.parse(row.challenger_json) as BattleParticipant,
    defender: JSON.parse(row.defender_json) as BattleParticipant,
    rounds: JSON.parse(row.rounds_json) as BattleRound[],
    winnerId: row.winner_id,
    stakeAmount: row.stake_amount,
    escrowTxHash: row.escrow_tx_hash,
    settlementTxHash: row.settlement_tx_hash,
    judgeModel: row.judge_model,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function createBattle(
  challengerShardId: string,
  defenderShardId: string,
  mode: BattleMode,
  stakeAmount: number,
  challengerOwnerId: string,
  defenderOwnerId: string
): Battle {
  const db = getDb();

  const challengerShard = getShardById(challengerShardId);
  const defenderShard = getShardById(defenderShardId);

  if (!challengerShard) throw new Error("Challenger shard not found");
  if (!defenderShard) throw new Error("Defender shard not found");

  const battle: Battle = {
    id: crypto.randomUUID(),
    mode,
    status: BattleStatus.Active,
    challenger: {
      keeperId: challengerOwnerId,
      shardId: challengerShardId,
      eloRating: challengerShard.eloRating,
      eloDelta: 0,
    },
    defender: {
      keeperId: defenderOwnerId,
      shardId: defenderShardId,
      eloRating: defenderShard.eloRating,
      eloDelta: 0,
    },
    rounds: [],
    winnerId: null,
    stakeAmount,
    escrowTxHash: null,
    settlementTxHash: null,
    judgeModel: "gpt-4o-mini",
    createdAt: Date.now(),
    completedAt: null,
  };

  const row = battleToRow(battle);
  db.prepare(`
    INSERT INTO battles (id, mode, status, challenger_json, defender_json, rounds_json, winner_id, stake_amount, escrow_tx_hash, settlement_tx_hash, judge_model, created_at, completed_at)
    VALUES (@id, @mode, @status, @challenger_json, @defender_json, @rounds_json, @winner_id, @stake_amount, @escrow_tx_hash, @settlement_tx_hash, @judge_model, @created_at, @completed_at)
  `).run(row);

  return battle;
}

export async function executeBattleRound(
  battleId: string,
  round: number
): Promise<BattleRound> {
  const db = getDb();
  const row = db.prepare("SELECT * FROM battles WHERE id = ?").get(battleId);
  if (!row) throw new Error("Battle not found");

  const battle = rowToBattle(row);
  const prompt = generateBattlePrompt(battle.mode, round);

  const battleRound: BattleRound = {
    roundNumber: round,
    prompt,
    challengerResponse: "",
    defenderResponse: "",
    scores: { challenger: 0, defender: 0 },
  };

  battle.rounds.push(battleRound);
  db.prepare("UPDATE battles SET rounds_json = ? WHERE id = ?").run(
    JSON.stringify(battle.rounds),
    battleId
  );

  return battleRound;
}

export async function judgeBattleRound(
  mode: BattleMode,
  prompt: string,
  responseA: string,
  responseB: string
): Promise<{ scores: { challenger: number; defender: number }; reasoning: string }> {
  const judgeResult = await generateBattleJudgment(mode, prompt, responseA, responseB);

  const scored = scoreBattleRound(mode, prompt, responseA, responseB, judgeResult);

  return {
    scores: { challenger: scored.challenger, defender: scored.defender },
    reasoning: scored.reasoning,
  };
}

export async function completeBattle(battleId: string): Promise<Battle> {
  const db = getDb();
  const row = db.prepare("SELECT * FROM battles WHERE id = ?").get(battleId);
  if (!row) throw new Error("Battle not found");

  const battle = rowToBattle(row);

  // Judge any unscored rounds
  for (const round of battle.rounds) {
    if (
      round.scores.challenger === 0 &&
      round.scores.defender === 0 &&
      round.challengerResponse &&
      round.defenderResponse
    ) {
      const result = await judgeBattleRound(
        battle.mode,
        round.prompt,
        round.challengerResponse,
        round.defenderResponse
      );
      round.scores = result.scores;
      round.reasoning = result.reasoning;
    }
  }

  // Determine winner
  const winnerId = determineBattleWinner(battle);
  battle.winnerId = winnerId;
  battle.status = BattleStatus.Completed;
  battle.completedAt = Date.now();

  // Calculate elo changes
  const isDraw = winnerId === null;
  const challengerIsWinner = winnerId === battle.challenger.shardId;

  const winnerElo = challengerIsWinner
    ? battle.challenger.eloRating
    : battle.defender.eloRating;
  const loserElo = challengerIsWinner
    ? battle.defender.eloRating
    : battle.challenger.eloRating;

  const eloChange = calculateEloChange(winnerElo, loserElo, isDraw);

  if (isDraw) {
    battle.challenger.eloDelta = eloChange.winnerDelta;
    battle.defender.eloDelta = eloChange.loserDelta;
  } else if (challengerIsWinner) {
    battle.challenger.eloDelta = eloChange.winnerDelta;
    battle.defender.eloDelta = eloChange.loserDelta;
  } else {
    battle.challenger.eloDelta = eloChange.loserDelta;
    battle.defender.eloDelta = eloChange.winnerDelta;
  }

  // Update shard elo ratings in the database
  db.prepare("UPDATE shards SET elo_rating = elo_rating + ? WHERE id = ?").run(
    battle.challenger.eloDelta,
    battle.challenger.shardId
  );
  db.prepare("UPDATE shards SET elo_rating = elo_rating + ? WHERE id = ?").run(
    battle.defender.eloDelta,
    battle.defender.shardId
  );

  // Update battle record
  const updatedRow = battleToRow(battle);
  db.prepare(`
    UPDATE battles
    SET status = @status, challenger_json = @challenger_json, defender_json = @defender_json,
        rounds_json = @rounds_json, winner_id = @winner_id, completed_at = @completed_at
    WHERE id = @id
  `).run(updatedRow);

  return battle;
}

export function getBattleById(battleId: string): Battle | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM battles WHERE id = ?").get(battleId);
  return row ? rowToBattle(row) : null;
}

export function getBattlesForOwner(ownerId: string): Battle[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM battles
       WHERE challenger_json LIKE ? OR defender_json LIKE ?
       ORDER BY created_at DESC`
    )
    .all(`%"keeperId":"${ownerId}"%`, `%"keeperId":"${ownerId}"%`);
  return rows.map(rowToBattle);
}

export function findMatch(entry: MatchmakingEntry): MatchmakingEntry | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT * FROM matchmaking_queue
       WHERE mode = ? AND owner_id != ? AND ABS(elo_rating - ?) <= 200
       ORDER BY ABS(elo_rating - ?) ASC
       LIMIT 1`
    )
    .get(entry.mode, entry.ownerId, entry.eloRating, entry.eloRating);

  if (!row) return null;

  return {
    id: (row as any).id,
    shardId: (row as any).shard_id,
    ownerId: (row as any).owner_id,
    mode: (row as any).mode as BattleMode,
    eloRating: (row as any).elo_rating,
    stakeAmount: (row as any).stake_amount,
    joinedAt: (row as any).joined_at,
  };
}

export function joinQueue(
  shardId: string,
  ownerId: string,
  mode: BattleMode,
  eloRating: number,
  stakeAmount: number
): MatchmakingEntry {
  const db = getDb();
  const entry: MatchmakingEntry = {
    id: crypto.randomUUID(),
    shardId,
    ownerId,
    mode,
    eloRating,
    stakeAmount,
    joinedAt: Date.now(),
  };

  db.prepare(`
    INSERT INTO matchmaking_queue (id, shard_id, owner_id, mode, elo_rating, stake_amount, joined_at)
    VALUES (@id, @shard_id, @owner_id, @mode, @elo_rating, @stake_amount, @joined_at)
  `).run({
    id: entry.id,
    shard_id: entry.shardId,
    owner_id: entry.ownerId,
    mode: entry.mode,
    elo_rating: entry.eloRating,
    stake_amount: entry.stakeAmount,
    joined_at: entry.joinedAt,
  });

  // Try to find a match immediately
  const match = findMatch(entry);
  if (match) {
    // Remove both entries from queue
    db.prepare("DELETE FROM matchmaking_queue WHERE id = ?").run(match.id);
    db.prepare("DELETE FROM matchmaking_queue WHERE id = ?").run(entry.id);

    // Create the battle
    createBattle(
      entry.shardId,
      match.shardId,
      mode,
      Math.min(entry.stakeAmount, match.stakeAmount),
      entry.ownerId,
      match.ownerId
    );
  }

  return entry;
}

export function leaveQueue(entryId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM matchmaking_queue WHERE id = ?").run(entryId);
}

export function getQueueEntries(ownerId: string): MatchmakingEntry[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM matchmaking_queue WHERE owner_id = ?")
    .all(ownerId);

  return rows.map((row: any) => ({
    id: row.id,
    shardId: row.shard_id,
    ownerId: row.owner_id,
    mode: row.mode as BattleMode,
    eloRating: row.elo_rating,
    stakeAmount: row.stake_amount,
    joinedAt: row.joined_at,
  }));
}
