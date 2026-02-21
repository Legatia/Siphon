import { getDb } from "@/lib/db";
import { getShardById } from "@/lib/shard-engine";
import { generateBattleJudgment, generateShardResponse } from "@/lib/llm";
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
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import {
  BATTLE_SETTLEMENT_ABI,
  BATTLE_SETTLEMENT_ADDRESS,
  idToBytes32,
} from "@/lib/contracts";
import { recordSeasonResult } from "@/lib/seasons";
import { evaluateAchievements } from "@/lib/achievements";

/**
 * Settle a staked battle on-chain via the BattleSettlement contract.
 * Uses the server-side ARBITER_PRIVATE_KEY to call settle().
 */
async function settleOnChain(
  battleIdHex: `0x${string}`,
  winnerAddress: `0x${string}`
): Promise<`0x${string}`> {
  const arbiterKey = process.env.ARBITER_PRIVATE_KEY;
  if (!arbiterKey) throw new Error("ARBITER_PRIVATE_KEY not configured");

  const account = privateKeyToAccount(arbiterKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });

  const hash = await walletClient.writeContract({
    address: BATTLE_SETTLEMENT_ADDRESS as `0x${string}`,
    abi: BATTLE_SETTLEMENT_ABI,
    functionName: "settle",
    args: [battleIdHex, winnerAddress],
  });

  return hash;
}

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
      keeperId: challengerOwnerId.toLowerCase(),
      shardId: challengerShardId,
      eloRating: challengerShard.eloRating,
      eloDelta: 0,
    },
    defender: {
      keeperId: defenderOwnerId.toLowerCase(),
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

  // Load shard data for AI response generation
  const challengerShard = getShardById(battle.challenger.shardId);
  const defenderShard = getShardById(battle.defender.shardId);

  // Generate AI responses for both shards
  let challengerResponse = "";
  let defenderResponse = "";

  if (challengerShard) {
    challengerResponse = await generateShardResponse(challengerShard, [], prompt);
  }
  if (defenderShard) {
    defenderResponse = await generateShardResponse(defenderShard, [], prompt);
  }

  const battleRound: BattleRound = {
    roundNumber: round,
    prompt,
    challengerResponse,
    defenderResponse,
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

  const challengerOwner = battle.challenger.keeperId.toLowerCase();
  const defenderOwner = battle.defender.keeperId.toLowerCase();
  const challengerWon = winnerId === battle.challenger.shardId;
  const defenderWon = winnerId === battle.defender.shardId;

  recordSeasonResult({
    ownerId: challengerOwner,
    points: isDraw ? 1 : challengerWon ? 3 : 0,
    win: challengerWon,
    loss: !isDraw && !challengerWon,
    draw: isDraw,
    eloDelta: battle.challenger.eloDelta,
  });
  recordSeasonResult({
    ownerId: defenderOwner,
    points: isDraw ? 1 : defenderWon ? 3 : 0,
    win: defenderWon,
    loss: !isDraw && !defenderWon,
    draw: isDraw,
    eloDelta: battle.defender.eloDelta,
  });
  evaluateAchievements(challengerOwner);
  evaluateAchievements(defenderOwner);

  // Settle on-chain for staked battles
  if (battle.stakeAmount > 0 && battle.escrowTxHash) {
    try {
      const battleIdHex = idToBytes32(battle.id);
      // Determine winner address: if draw, send address(0)
      let winnerAddr: `0x${string}` = "0x0000000000000000000000000000000000000000";
      if (winnerId === battle.challenger.shardId) {
        winnerAddr = battle.challenger.keeperId as `0x${string}`;
      } else if (winnerId === battle.defender.shardId) {
        winnerAddr = battle.defender.keeperId as `0x${string}`;
      }

      const txHash = await settleOnChain(battleIdHex, winnerAddr);
      battle.settlementTxHash = txHash;
    } catch (err) {
      console.error("On-chain settlement failed:", err);
      // Continue with off-chain settlement — don't block the result
    }
  }

  // Update battle record
  const updatedRow = battleToRow(battle);
  db.prepare(`
    UPDATE battles
    SET status = @status, challenger_json = @challenger_json, defender_json = @defender_json,
        rounds_json = @rounds_json, winner_id = @winner_id, settlement_tx_hash = @settlement_tx_hash, completed_at = @completed_at
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
  // Sanitize LIKE special chars and validate address format
  const sanitized = ownerId.toLowerCase().replace(/[%_\\]/g, "");
  if (!/^0x[a-f0-9]{40}$/.test(sanitized)) return [];

  const pattern = `%"keeperId":"${sanitized}"%`;
  const rows = db
    .prepare(
      `SELECT * FROM battles
       WHERE challenger_json LIKE ? OR defender_json LIKE ?
       ORDER BY created_at DESC`
    )
    .all(pattern, pattern);
  return rows.map(rowToBattle);
}

export function findMatch(entry: MatchmakingEntry): MatchmakingEntry | null {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM matchmaking_queue
       WHERE mode = ? AND owner_id != ?
       ORDER BY joined_at ASC`
    )
    .all(entry.mode, entry.ownerId) as any[];

  const now = Date.now();
  const myWait = Math.max(0, now - entry.joinedAt);
  const myRange = Math.min(1200, 200 + Math.floor(myWait / 30_000) * 100);

  const candidates = rows
    .map((row) => ({
      id: row.id,
      shardId: row.shard_id,
      ownerId: row.owner_id,
      mode: row.mode as BattleMode,
      eloRating: row.elo_rating,
      stakeAmount: row.stake_amount,
      joinedAt: row.joined_at,
      eloDiff: Math.abs(row.elo_rating - entry.eloRating),
      oppRange: Math.min(1200, 200 + Math.floor(Math.max(0, now - row.joined_at) / 30_000) * 100),
    }))
    .filter((row) => row.eloDiff <= myRange && row.eloDiff <= row.oppRange)
    .sort((a, b) => a.eloDiff - b.eloDiff);

  if (!candidates.length) return null;
  const winner = candidates[0]!;
  return {
    id: winner.id,
    shardId: winner.shardId,
    ownerId: winner.ownerId,
    mode: winner.mode,
    eloRating: winner.eloRating,
    stakeAmount: winner.stakeAmount,
    joinedAt: winner.joinedAt,
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

export function leaveQueueForOwner(entryId: string, ownerId: string): boolean {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM matchmaking_queue WHERE id = ? AND owner_id = ?")
    .run(entryId, ownerId);
  return result.changes > 0;
}

export function getQueueEntries(ownerId: string): MatchmakingEntry[] {
  const db = getDb();
  const timeoutAt = Date.now() - 10 * 60 * 1000;
  db.prepare("DELETE FROM matchmaking_queue WHERE joined_at < ?").run(timeoutAt);
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
    searchRange: Math.min(1200, 200 + Math.floor(Math.max(0, Date.now() - row.joined_at) / 30_000) * 100),
  }));
}

export function attemptQueueMatches(mode?: BattleMode): number {
  const db = getDb();
  const rows = mode
    ? (db.prepare("SELECT * FROM matchmaking_queue WHERE mode = ? ORDER BY joined_at ASC").all(mode) as any[])
    : (db.prepare("SELECT * FROM matchmaking_queue ORDER BY joined_at ASC").all() as any[]);

  let created = 0;
  for (const row of rows) {
    const entry: MatchmakingEntry = {
      id: row.id,
      shardId: row.shard_id,
      ownerId: row.owner_id,
      mode: row.mode as BattleMode,
      eloRating: row.elo_rating,
      stakeAmount: row.stake_amount,
      joinedAt: row.joined_at,
    };
    const match = findMatch(entry);
    if (!match) continue;

    const stillExists = db.prepare("SELECT id FROM matchmaking_queue WHERE id = ?").get(entry.id);
    const opponentExists = db.prepare("SELECT id FROM matchmaking_queue WHERE id = ?").get(match.id);
    if (!stillExists || !opponentExists) continue;

    db.prepare("DELETE FROM matchmaking_queue WHERE id = ?").run(match.id);
    db.prepare("DELETE FROM matchmaking_queue WHERE id = ?").run(entry.id);
    createBattle(
      entry.shardId,
      match.shardId,
      entry.mode,
      Math.min(entry.stakeAmount, match.stakeAmount),
      entry.ownerId,
      match.ownerId
    );
    created += 1;
  }
  return created;
}
