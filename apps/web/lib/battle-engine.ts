import { getDb, dbGet, dbAll, dbRun } from "@/lib/db";
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

const BATTLE_DISPUTE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const BATTLE_STATE_SETTLED = 3;
const BATTLE_STATE_DISPUTED = 4;
const BATTLE_STATE_RESOLVED = 5;

const chainPublicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

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

async function finalizeOnChain(
  battleIdHex: `0x${string}`
): Promise<`0x${string}`> {
  const arbiterKey = process.env.ARBITER_PRIVATE_KEY;
  if (!arbiterKey) throw new Error("ARBITER_PRIVATE_KEY not configured");

  const account = privateKeyToAccount(arbiterKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });

  return walletClient.writeContract({
    address: BATTLE_SETTLEMENT_ADDRESS as `0x${string}`,
    abi: BATTLE_SETTLEMENT_ABI,
    functionName: "finalizeSettlement",
    args: [battleIdHex],
  });
}

async function getOnChainBattleState(
  battleIdHex: `0x${string}`
): Promise<number | null> {
  try {
    const battle: any = await chainPublicClient.readContract({
      address: BATTLE_SETTLEMENT_ADDRESS as `0x${string}`,
      abi: BATTLE_SETTLEMENT_ABI,
      functionName: "getBattle",
      args: [battleIdHex],
    });

    if (typeof battle?.state === "bigint") {
      return Number(battle.state);
    }
    if (Array.isArray(battle) && typeof battle[4] === "bigint") {
      return Number(battle[4]);
    }
    return null;
  } catch {
    return null;
  }
}

function winnerAddressForBattle(battle: Battle): `0x${string}` {
  if (!battle.winnerId) {
    return "0x0000000000000000000000000000000000000000";
  }
  if (battle.winnerId === battle.challenger.shardId) {
    return battle.challenger.keeperId as `0x${string}`;
  }
  if (battle.winnerId === battle.defender.shardId) {
    return battle.defender.keeperId as `0x${string}`;
  }
  return "0x0000000000000000000000000000000000000000";
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
    finalization_tx_hash: battle.finalizationTxHash ?? null,
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
    finalizationTxHash: row.finalization_tx_hash ?? null,
    judgeModel: row.judge_model,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export async function createBattle(
  challengerShardId: string,
  defenderShardId: string,
  mode: BattleMode,
  stakeAmount: number,
  challengerOwnerId: string,
  defenderOwnerId: string
): Promise<Battle> {
  const challengerShard = await getShardById(challengerShardId);
  const defenderShard = await getShardById(defenderShardId);

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
    finalizationTxHash: null,
    judgeModel: "gpt-4o-mini",
    createdAt: Date.now(),
    completedAt: null,
  };

  const row = battleToRow(battle);
  const c = await getDb();
  await c.execute({
    sql: `INSERT INTO battles (id, mode, status, challenger_json, defender_json, rounds_json, winner_id, stake_amount, escrow_tx_hash, settlement_tx_hash, finalization_tx_hash, judge_model, created_at, completed_at)
    VALUES (:id, :mode, :status, :challenger_json, :defender_json, :rounds_json, :winner_id, :stake_amount, :escrow_tx_hash, :settlement_tx_hash, :finalization_tx_hash, :judge_model, :created_at, :completed_at)`,
    args: {
      id: row.id,
      mode: row.mode,
      status: row.status,
      challenger_json: row.challenger_json,
      defender_json: row.defender_json,
      rounds_json: row.rounds_json,
      winner_id: row.winner_id,
      stake_amount: row.stake_amount,
      escrow_tx_hash: row.escrow_tx_hash,
      settlement_tx_hash: row.settlement_tx_hash,
      finalization_tx_hash: row.finalization_tx_hash,
      judge_model: row.judge_model,
      created_at: row.created_at,
      completed_at: row.completed_at,
    },
  });

  return battle;
}

export async function executeBattleRound(
  battleId: string,
  round: number
): Promise<BattleRound> {
  const row = await dbGet("SELECT * FROM battles WHERE id = ?", battleId);
  if (!row) throw new Error("Battle not found");

  const battle = rowToBattle(row);
  const prompt = generateBattlePrompt(battle.mode, round);

  // Load shard data for AI response generation
  const challengerShard = await getShardById(battle.challenger.shardId);
  const defenderShard = await getShardById(battle.defender.shardId);

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
  await dbRun(
    "UPDATE battles SET rounds_json = ? WHERE id = ?",
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
  const row = await dbGet("SELECT * FROM battles WHERE id = ?", battleId);
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
  await dbRun(
    "UPDATE shards SET elo_rating = elo_rating + ? WHERE id = ?",
    battle.challenger.eloDelta,
    battle.challenger.shardId
  );
  await dbRun(
    "UPDATE shards SET elo_rating = elo_rating + ? WHERE id = ?",
    battle.defender.eloDelta,
    battle.defender.shardId
  );

  const challengerOwner = battle.challenger.keeperId.toLowerCase();
  const defenderOwner = battle.defender.keeperId.toLowerCase();
  const challengerWon = winnerId === battle.challenger.shardId;
  const defenderWon = winnerId === battle.defender.shardId;

  await recordSeasonResult({
    ownerId: challengerOwner,
    points: isDraw ? 1 : challengerWon ? 3 : 0,
    win: challengerWon,
    loss: !isDraw && !challengerWon,
    draw: isDraw,
    eloDelta: battle.challenger.eloDelta,
  });
  await recordSeasonResult({
    ownerId: defenderOwner,
    points: isDraw ? 1 : defenderWon ? 3 : 0,
    win: defenderWon,
    loss: !isDraw && !defenderWon,
    draw: isDraw,
    eloDelta: battle.defender.eloDelta,
  });
  await evaluateAchievements(challengerOwner);
  await evaluateAchievements(defenderOwner);

  // Trigger on-chain settlement for staked battles; payout finalization is synced separately.
  if (battle.stakeAmount > 0 && battle.escrowTxHash && !battle.settlementTxHash) {
    try {
      const battleIdHex = idToBytes32(battle.id);
      const txHash = await settleOnChain(battleIdHex, winnerAddressForBattle(battle));
      battle.settlementTxHash = txHash;
    } catch (err) {
      console.error("On-chain settlement failed:", err);
      // Keep off-chain result; settlement can be retried by sync.
    }
  }

  // Update battle record
  const updatedRow = battleToRow(battle);
  const c = await getDb();
  await c.execute({
    sql: `UPDATE battles
    SET status = :status, challenger_json = :challenger_json, defender_json = :defender_json,
        rounds_json = :rounds_json, winner_id = :winner_id, settlement_tx_hash = :settlement_tx_hash,
        finalization_tx_hash = :finalization_tx_hash, completed_at = :completed_at
    WHERE id = :id`,
    args: {
      id: updatedRow.id,
      status: updatedRow.status,
      challenger_json: updatedRow.challenger_json,
      defender_json: updatedRow.defender_json,
      rounds_json: updatedRow.rounds_json,
      winner_id: updatedRow.winner_id,
      settlement_tx_hash: updatedRow.settlement_tx_hash,
      finalization_tx_hash: updatedRow.finalization_tx_hash,
      completed_at: updatedRow.completed_at,
    },
  });

  return battle;
}

export async function syncBattleOnChainSettlement(battleId: string): Promise<Battle | null> {
  const battle = await getBattleById(battleId);
  if (!battle) return null;
  if (battle.status !== BattleStatus.Completed) return battle;
  if (!(battle.stakeAmount > 0 && battle.escrowTxHash)) return battle;
  if (!process.env.ARBITER_PRIVATE_KEY) return battle;

  let changed = false;
  const battleIdHex = idToBytes32(battle.id);

  if (!battle.settlementTxHash) {
    try {
      battle.settlementTxHash = await settleOnChain(
        battleIdHex,
        winnerAddressForBattle(battle)
      );
      changed = true;
    } catch (err) {
      console.error("Failed to sync settle() on-chain:", err);
    }
  }

  const canFinalize =
    battle.completedAt !== null &&
    Date.now() >= battle.completedAt + BATTLE_DISPUTE_WINDOW_MS &&
    !battle.finalizationTxHash;

  if (canFinalize) {
    const onChainState = await getOnChainBattleState(battleIdHex);
    if (onChainState === BATTLE_STATE_SETTLED) {
      try {
        battle.finalizationTxHash = await finalizeOnChain(battleIdHex);
        changed = true;
      } catch (err) {
        console.error("Failed to finalize settlement on-chain:", err);
      }
    } else if (onChainState === BATTLE_STATE_DISPUTED) {
      // Disputed battles require explicit arbiter resolveDispute action.
      console.warn(`Battle ${battle.id} is disputed on-chain and requires resolveDispute.`);
    } else if (onChainState === BATTLE_STATE_RESOLVED) {
      // Already resolved by another caller.
      battle.finalizationTxHash = battle.finalizationTxHash ?? "resolved_onchain";
      changed = true;
    }
  }

  if (changed) {
    const bRow = battleToRow(battle);
    const c = await getDb();
    await c.execute({
      sql: `UPDATE battles
      SET settlement_tx_hash = :settlement_tx_hash, finalization_tx_hash = :finalization_tx_hash
      WHERE id = :id`,
      args: {
        id: bRow.id,
        settlement_tx_hash: bRow.settlement_tx_hash,
        finalization_tx_hash: bRow.finalization_tx_hash,
      },
    });
  }

  return battle;
}

export async function syncOutstandingBattleSettlements(
  limit = 25
): Promise<{ checked: number; updated: number }> {
  const rows = await dbAll<{
    id: string;
    settlement_tx_hash: string | null;
    finalization_tx_hash: string | null;
  }>(
    `SELECT id, settlement_tx_hash, finalization_tx_hash
     FROM battles
     WHERE status = 'completed'
       AND stake_amount > 0
       AND escrow_tx_hash IS NOT NULL
       AND (settlement_tx_hash IS NULL OR finalization_tx_hash IS NULL)
     ORDER BY completed_at ASC
     LIMIT ?`,
    limit
  );

  let updated = 0;
  for (const row of rows) {
    const synced = await syncBattleOnChainSettlement(row.id);
    if (!synced) continue;
    const settlementChanged = (synced.settlementTxHash ?? null) !== row.settlement_tx_hash;
    const finalizationChanged =
      (synced.finalizationTxHash ?? null) !== (row.finalization_tx_hash ?? null);
    if (settlementChanged || finalizationChanged) {
      updated += 1;
    }
  }

  return { checked: rows.length, updated };
}

export async function getBattleById(battleId: string): Promise<Battle | null> {
  const row = await dbGet("SELECT * FROM battles WHERE id = ?", battleId);
  return row ? rowToBattle(row) : null;
}

export async function getBattlesForOwner(ownerId: string): Promise<Battle[]> {
  // Sanitize LIKE special chars and validate address format
  const sanitized = ownerId.toLowerCase().replace(/[%_\\]/g, "");
  if (!/^0x[a-f0-9]{40}$/.test(sanitized)) return [];

  const pattern = `%"keeperId":"${sanitized}"%`;
  const rows = await dbAll(
    `SELECT * FROM battles
     WHERE challenger_json LIKE ? OR defender_json LIKE ?
     ORDER BY created_at DESC`,
    pattern,
    pattern
  );
  return rows.map(rowToBattle);
}

export async function findMatch(entry: MatchmakingEntry): Promise<MatchmakingEntry | null> {
  const rows = await dbAll<any>(
    `SELECT * FROM matchmaking_queue
     WHERE mode = ? AND owner_id != ?
     ORDER BY joined_at ASC`,
    entry.mode,
    entry.ownerId
  );

  const now = Date.now();
  const myWait = Math.max(0, now - entry.joinedAt);
  const myRange = Math.min(1200, 200 + Math.floor(myWait / 30_000) * 100);

  const candidates = rows
    .map((row: any) => ({
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
    .filter((row: any) => row.eloDiff <= myRange && row.eloDiff <= row.oppRange)
    .sort((a: any, b: any) => a.eloDiff - b.eloDiff);

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

export async function joinQueue(
  shardId: string,
  ownerId: string,
  mode: BattleMode,
  eloRating: number,
  stakeAmount: number
): Promise<MatchmakingEntry> {
  const entry: MatchmakingEntry = {
    id: crypto.randomUUID(),
    shardId,
    ownerId,
    mode,
    eloRating,
    stakeAmount,
    joinedAt: Date.now(),
  };

  const c = await getDb();
  await c.execute({
    sql: `INSERT INTO matchmaking_queue (id, shard_id, owner_id, mode, elo_rating, stake_amount, joined_at)
    VALUES (:id, :shard_id, :owner_id, :mode, :elo_rating, :stake_amount, :joined_at)`,
    args: {
      id: entry.id,
      shard_id: entry.shardId,
      owner_id: entry.ownerId,
      mode: entry.mode,
      elo_rating: entry.eloRating,
      stake_amount: entry.stakeAmount,
      joined_at: entry.joinedAt,
    },
  });

  // Try to find a match immediately
  const match = await findMatch(entry);
  if (match) {
    // Remove both entries from queue
    await dbRun("DELETE FROM matchmaking_queue WHERE id = ?", match.id);
    await dbRun("DELETE FROM matchmaking_queue WHERE id = ?", entry.id);

    // Create the battle
    await createBattle(
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

export async function leaveQueue(entryId: string): Promise<void> {
  await dbRun("DELETE FROM matchmaking_queue WHERE id = ?", entryId);
}

export async function leaveQueueForOwner(entryId: string, ownerId: string): Promise<boolean> {
  const result = await dbRun(
    "DELETE FROM matchmaking_queue WHERE id = ? AND owner_id = ?",
    entryId,
    ownerId
  );
  return (result.rowsAffected ?? 0) > 0;
}

export async function getQueueEntries(ownerId: string): Promise<MatchmakingEntry[]> {
  const timeoutAt = Date.now() - 10 * 60 * 1000;
  await dbRun("DELETE FROM matchmaking_queue WHERE joined_at < ?", timeoutAt);
  const rows = await dbAll<any>(
    "SELECT * FROM matchmaking_queue WHERE owner_id = ?",
    ownerId
  );

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

export async function attemptQueueMatches(mode?: BattleMode): Promise<number> {
  const rows = mode
    ? await dbAll<any>("SELECT * FROM matchmaking_queue WHERE mode = ? ORDER BY joined_at ASC", mode)
    : await dbAll<any>("SELECT * FROM matchmaking_queue ORDER BY joined_at ASC");

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
    const match = await findMatch(entry);
    if (!match) continue;

    const stillExists = await dbGet("SELECT id FROM matchmaking_queue WHERE id = ?", entry.id);
    const opponentExists = await dbGet("SELECT id FROM matchmaking_queue WHERE id = ?", match.id);
    if (!stillExists || !opponentExists) continue;

    await dbRun("DELETE FROM matchmaking_queue WHERE id = ?", match.id);
    await dbRun("DELETE FROM matchmaking_queue WHERE id = ?", entry.id);
    await createBattle(
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
