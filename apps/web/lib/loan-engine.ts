import { getDb, rowToShard } from "./db";
import { LoanState } from "@siphon/core";
import type { Loan, Shard, ShardAttestation, LoanListing } from "@siphon/core";
import crypto from "crypto";

export interface CreateLoanParams {
  shardId: string;
  borrower: string;
  principal: string;
  interestBps: number;
  duration: number;
  collateralValue: string;
  txHash?: string;
}

export function createLoan(params: CreateLoanParams): Loan {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();

  db.prepare(
    `INSERT INTO loans (id, shard_id, borrower, principal, interest_bps, duration, collateral_value, state, created_at, tx_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
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

  return rowToLoan(db.prepare("SELECT * FROM loans WHERE id = ?").get(id));
}

export function fundLoan(loanId: string, lender: string, txHash?: string): Loan {
  const db = getDb();
  const now = Date.now();

  db.prepare(
    `UPDATE loans SET lender = ?, funded_at = ?, state = ?, fund_tx_hash = ? WHERE id = ? AND state = ?`
  ).run(lender, now, LoanState.Funded, txHash ?? null, loanId, LoanState.Listed);

  return rowToLoan(db.prepare("SELECT * FROM loans WHERE id = ?").get(loanId));
}

export function repayLoan(loanId: string, txHash?: string): Loan {
  const db = getDb();

  db.prepare(
    `UPDATE loans SET state = ?, repay_tx_hash = ? WHERE id = ? AND state = ?`
  ).run(LoanState.Repaid, txHash ?? null, loanId, LoanState.Funded);

  return rowToLoan(db.prepare("SELECT * FROM loans WHERE id = ?").get(loanId));
}

export function liquidateLoan(loanId: string, txHash?: string): Loan {
  const db = getDb();

  db.prepare(
    `UPDATE loans SET state = ?, liquidate_tx_hash = ? WHERE id = ? AND state = ?`
  ).run(LoanState.Liquidated, txHash ?? null, loanId, LoanState.Funded);

  return rowToLoan(db.prepare("SELECT * FROM loans WHERE id = ?").get(loanId));
}

export function cancelLoan(loanId: string): Loan {
  const db = getDb();

  db.prepare(
    `UPDATE loans SET state = ? WHERE id = ? AND state = ?`
  ).run(LoanState.Cancelled, loanId, LoanState.Listed);

  return rowToLoan(db.prepare("SELECT * FROM loans WHERE id = ?").get(loanId));
}

export function getLoan(loanId: string): Loan | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM loans WHERE id = ?").get(loanId);
  return row ? rowToLoan(row) : null;
}

export function getLoans(filters?: {
  borrower?: string;
  lender?: string;
  state?: LoanState;
}): Loan[] {
  const db = getDb();
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

  return db.prepare(sql).all(...params).map(rowToLoan);
}

export function getLoanListings(): LoanListing[] {
  const db = getDb();
  const loans = db
    .prepare("SELECT * FROM loans WHERE state = ? ORDER BY created_at DESC")
    .all(LoanState.Listed)
    .map(rowToLoan);

  return loans.map((loan) => {
    const shardRow = db.prepare("SELECT * FROM shards WHERE id = ?").get(loan.shardId);
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

    return { loan, shard, attestation, repaymentAmount, isExpired, isLiquidatable };
  });
}

export function getActiveLoans(): LoanListing[] {
  const db = getDb();
  const loans = db
    .prepare("SELECT * FROM loans WHERE state = ? ORDER BY created_at DESC")
    .all(LoanState.Funded)
    .map(rowToLoan);

  return loans.map((loan) => {
    const shardRow = db.prepare("SELECT * FROM shards WHERE id = ?").get(loan.shardId);
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

    return { loan, shard, attestation, repaymentAmount, isExpired, isLiquidatable };
  });
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
