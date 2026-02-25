import { dbGet, dbAll } from "@/lib/db";

export interface OperatorReputation {
  address: string;
  completedAsClaimant: number;
  claimedTotal: number;
  disputedAsClaimant: number;
  postedTotal: number;
  completedAsPoster: number;
  battleWins: number;
  battleTotal: number;
  completionRate: number;
  disputeRate: number;
  earningsEth: number;
  trustScore: number;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export async function getOperatorReputation(address: string): Promise<OperatorReputation> {
  const a = address.toLowerCase();

  const claimedTotal =
    ((await dbGet<any>("SELECT COUNT(*) as count FROM bounties WHERE claimant = ?", a))?.count ?? 0) as number;
  const completedAsClaimant =
    ((await dbGet<any>("SELECT COUNT(*) as count FROM bounties WHERE claimant = ? AND state = 'Completed'", a))?.count ?? 0) as number;
  const disputedAsClaimant =
    ((await dbGet<any>("SELECT COUNT(*) as count FROM bounties WHERE claimant = ? AND state = 'Disputed'", a))?.count ?? 0) as number;

  const postedTotal =
    ((await dbGet<any>("SELECT COUNT(*) as count FROM bounties WHERE poster = ?", a))?.count ?? 0) as number;
  const completedAsPoster =
    ((await dbGet<any>("SELECT COUNT(*) as count FROM bounties WHERE poster = ? AND state = 'Completed'", a))?.count ?? 0) as number;

  const earningsRow = await dbAll<{ reward: string }>(
    "SELECT reward FROM bounties WHERE claimant = ? AND state = 'Completed'",
    a
  );
  const earningsEth = earningsRow.reduce(
    (sum, row) => sum + Number.parseFloat(String(row.reward || "0")),
    0
  );

  const battleRows = await dbAll<{
    winner_id: string | null;
    challenger_json: string;
    defender_json: string;
  }>(
    "SELECT winner_id, challenger_json, defender_json FROM battles WHERE status = 'completed'"
  );

  let battleTotal = 0;
  let battleWins = 0;
  for (const row of battleRows) {
    const challenger = JSON.parse(row.challenger_json) as { keeperId: string; shardId: string };
    const defender = JSON.parse(row.defender_json) as { keeperId: string; shardId: string };

    if (challenger.keeperId?.toLowerCase() === a || defender.keeperId?.toLowerCase() === a) {
      battleTotal += 1;
      const won =
        (challenger.keeperId?.toLowerCase() === a && row.winner_id === challenger.shardId) ||
        (defender.keeperId?.toLowerCase() === a && row.winner_id === defender.shardId);
      if (won) battleWins += 1;
    }
  }

  const completionRate = claimedTotal > 0 ? completedAsClaimant / claimedTotal : 0;
  const disputeRate = claimedTotal > 0 ? disputedAsClaimant / claimedTotal : 0;

  const trustScore = clamp(
    Math.round(
      40 +
        completionRate * 35 +
        Math.min(1, battleTotal > 0 ? battleWins / battleTotal : 0) * 10 +
        Math.min(1, earningsEth / 2) * 20 -
        disputeRate * 25
    ),
    0,
    100
  );

  return {
    address: a,
    completedAsClaimant,
    claimedTotal,
    disputedAsClaimant,
    postedTotal,
    completedAsPoster,
    battleWins,
    battleTotal,
    completionRate,
    disputeRate,
    earningsEth,
    trustScore,
  };
}

export async function getOperatorReputationBatch(addresses: string[]) {
  const unique = Array.from(new Set(addresses.map((a) => a.toLowerCase()).filter(Boolean))).slice(0, 100);
  return Promise.all(unique.map((address) => getOperatorReputation(address)));
}
