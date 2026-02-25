import { getDb, rowToShard, dbGet, dbAll, dbRun } from "./db";
import { LoanState } from "@siphon/core";
import type { Loan, Shard, ShardAttestation, LoanListing } from "@siphon/core";
import crypto from "crypto";

export interface CreateLoanParams {
  id?: string;
  shardId: string;
  borrower: string;
  principal: string;
  interestBps: number;
  duration: number;
  collateralValue: string;
  txHash?: string;
}

export async function createLoan(params: CreateLoanParams): Promise<Loan> {
  const id = params.id ?? crypto.randomUUID();
  const now = Date.now();

  await dbRun(
    `INSERT INTO loans (id, shard_id, borrower, principal, interest_bps, duration, collateral_value, state, created_at, tx_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    params.shardId,
    params.borrower,
    params.principal,
    params.interestBps,
    params.duration,
    params.collateralValue,
    LoanState.Listed,
    now,
    params.txHash ?? null
  );

  return rowToLoan(await dbGet("SELECT * FROM loans WHERE id = ?", id));
}

export async function fundLoan(loanId: string, lender: string, txHash?: string): Promise<Loan> {
  const now = Date.now();

  await dbRun(
    `UPDATE loans SET lender = ?, funded_at = ?, state = ?, fund_tx_hash = ? WHERE id = ? AND state = ?`,
    lender,
    now,
    LoanState.Funded,
    txHash ?? null,
    loanId,
    LoanState.Listed
  );

  return rowToLoan(await dbGet("SELECT * FROM loans WHERE id = ?", loanId));
}

export async function repayLoan(loanId: string, txHash?: string): Promise<Loan> {
  await dbRun(
    `UPDATE loans SET state = ?, repay_tx_hash = ? WHERE id = ? AND state = ?`,
    LoanState.Repaid,
    txHash ?? null,
    loanId,
    LoanState.Funded
  );

  return rowToLoan(await dbGet("SELECT * FROM loans WHERE id = ?", loanId));
}

export async function liquidateLoan(loanId: string, txHash?: string): Promise<Loan> {
  // Get loan before updating to know the lender and shard
  const existing = await dbGet<any>("SELECT * FROM loans WHERE id = ?", loanId);

  await dbRun(
    `UPDATE loans SET state = ?, liquidate_tx_hash = ? WHERE id = ? AND state = ?`,
    LoanState.Liquidated,
    txHash ?? null,
    loanId,
    LoanState.Funded
  );

  // On-chain, seize() transfers shard ownership to the lender — mirror in DB
  if (existing?.lender && existing?.shard_id) {
    await dbRun(
      "UPDATE shards SET owner_id = ? WHERE id = ?",
      existing.lender,
      existing.shard_id
    );
  }

  return rowToLoan(await dbGet("SELECT * FROM loans WHERE id = ?", loanId));
}

export async function cancelLoan(loanId: string, txHash?: string): Promise<Loan> {
  await dbRun(
    `UPDATE loans SET state = ?, cancel_tx_hash = ? WHERE id = ? AND state = ?`,
    LoanState.Cancelled,
    txHash ?? null,
    loanId,
    LoanState.Listed
  );

  return rowToLoan(await dbGet("SELECT * FROM loans WHERE id = ?", loanId));
}

export async function findLoanTxUsage(txHash: string): Promise<{ loanId: string; column: string } | null> {
  const row = await dbGet<{
    id: string;
    tx_hash: string | null;
    fund_tx_hash: string | null;
    repay_tx_hash: string | null;
    liquidate_tx_hash: string | null;
    cancel_tx_hash: string | null;
  }>(
    `SELECT id, tx_hash, fund_tx_hash, repay_tx_hash, liquidate_tx_hash, cancel_tx_hash
       FROM loans
      WHERE tx_hash = ?
         OR fund_tx_hash = ?
         OR repay_tx_hash = ?
         OR liquidate_tx_hash = ?
         OR cancel_tx_hash = ?
      LIMIT 1`,
    txHash,
    txHash,
    txHash,
    txHash,
    txHash
  );

  if (!row) return null;
  if (row.tx_hash === txHash) return { loanId: row.id, column: "tx_hash" };
  if (row.fund_tx_hash === txHash) return { loanId: row.id, column: "fund_tx_hash" };
  if (row.repay_tx_hash === txHash) return { loanId: row.id, column: "repay_tx_hash" };
  if (row.liquidate_tx_hash === txHash) return { loanId: row.id, column: "liquidate_tx_hash" };
  if (row.cancel_tx_hash === txHash) return { loanId: row.id, column: "cancel_tx_hash" };
  return null;
}

export async function getLoan(loanId: string): Promise<Loan | null> {
  const row = await dbGet("SELECT * FROM loans WHERE id = ?", loanId);
  return row ? rowToLoan(row) : null;
}

export async function getLoans(filters?: {
  borrower?: string;
  lender?: string;
  state?: LoanState;
}): Promise<Loan[]> {
  let sql = "SELECT * FROM loans WHERE 1=1";
  const params: any[] = [];

  if (filters?.borrower) {
    sql += " AND borrower = ?";
    params.push(filters.borrower);
  }
  if (filters?.lender) {
    sql += " AND lender = ?";
    params.push(filters.lender);
  }
  if (filters?.state !== undefined) {
    sql += " AND state = ?";
    params.push(filters.state);
  }

  sql += " ORDER BY created_at DESC";

  const rows = await dbAll(sql, ...params);
  return rows.map(rowToLoan);
}

export async function getLoanListings(): Promise<LoanListing[]> {
  const loanRows = await dbAll(
    "SELECT * FROM loans WHERE state = ? ORDER BY created_at DESC",
    LoanState.Listed
  );
  const loans = loanRows.map(rowToLoan);

  const results: LoanListing[] = [];
  for (const loan of loans) {
    const shardRow = await dbGet("SELECT * FROM shards WHERE id = ?", loan.shardId);
    const shard: Shard = shardRow ? rowToShard(shardRow) : ({} as Shard);

    const stats = shard.stats || { intelligence: 0, creativity: 0, precision: 0, resilience: 0, charisma: 0 };
    const statsSum = stats.intelligence + stats.creativity + stats.precision + stats.resilience + stats.charisma;

    const attestation: ShardAttestation = {
      shardId: loan.shardId,
      level: shard.level || 1,
      elo: shard.eloRating || 1200,
      statsSum,
      timestamp: Date.now(),
      attestedBy: "local",
    };

    const principal = BigInt(loan.principal);
    const interest = (principal * BigInt(loan.interestBps)) / BigInt(10000);
    const repaymentAmount = (principal + interest).toString();

    const now = Date.now();
    const isExpired = loan.fundedAt
      ? now >= loan.fundedAt + loan.duration * 1000
      : false;
    const isLiquidatable = loan.fundedAt
      ? now >= loan.fundedAt + loan.duration * 1000 + 86400000
      : false;

    results.push({ loan, shard, attestation, repaymentAmount, isExpired, isLiquidatable });
  }

  return results;
}

export async function getActiveLoans(): Promise<LoanListing[]> {
  const loanRows = await dbAll(
    "SELECT * FROM loans WHERE state = ? ORDER BY created_at DESC",
    LoanState.Funded
  );
  const loans = loanRows.map(rowToLoan);

  const results: LoanListing[] = [];
  for (const loan of loans) {
    const shardRow = await dbGet("SELECT * FROM shards WHERE id = ?", loan.shardId);
    const shard: Shard = shardRow ? rowToShard(shardRow) : ({} as Shard);

    const stats = shard.stats || { intelligence: 0, creativity: 0, precision: 0, resilience: 0, charisma: 0 };
    const statsSum = stats.intelligence + stats.creativity + stats.precision + stats.resilience + stats.charisma;

    const attestation: ShardAttestation = {
      shardId: loan.shardId,
      level: shard.level || 1,
      elo: shard.eloRating || 1200,
      statsSum,
      timestamp: Date.now(),
      attestedBy: "local",
    };

    const principal = BigInt(loan.principal);
    const interest = (principal * BigInt(loan.interestBps)) / BigInt(10000);
    const repaymentAmount = (principal + interest).toString();

    const now = Date.now();
    const isExpired = loan.fundedAt
      ? now >= loan.fundedAt + loan.duration * 1000
      : false;
    const isLiquidatable = loan.fundedAt
      ? now >= loan.fundedAt + loan.duration * 1000 + 86400000
      : false;

    results.push({ loan, shard, attestation, repaymentAmount, isExpired, isLiquidatable });
  }

  return results;
}

function rowToLoan(row: any): Loan {
  return {
    id: row.id,
    shardId: row.shard_id,
    borrower: row.borrower,
    lender: row.lender ?? null,
    principal: row.principal,
    interestBps: row.interest_bps,
    duration: row.duration,
    fundedAt: row.funded_at ?? null,
    collateralValue: row.collateral_value,
    state: row.state,
    createdAt: row.created_at,
  };
}
