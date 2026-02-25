import { decodeEventLog, decodeFunctionData, type Hex, isAddressEqual } from "viem";
import {
  LOAN_VAULT_ABI,
  LOAN_VAULT_ADDRESS,
  LOAN_VAULT_CONFIGURED,
  ZERO_EVM_ADDRESS,
  idToBytes32,
  publicClient,
} from "@/lib/contracts";

type VerifyResult = { ok: true } | { ok: false; error: string };

function normalizeAddress(address: string): `0x${string}` {
  return address.toLowerCase() as `0x${string}`;
}

function toBigIntStrict(value: string | number | bigint): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
}

function receiptHasEvent(params: {
  receipt: Awaited<ReturnType<typeof publicClient.getTransactionReceipt>>;
  eventName: "LoanListed" | "LoanFunded" | "LoanRepaid" | "LoanLiquidated" | "LoanCancelled";
  loanId: string;
  shardId?: string;
  borrower?: string;
  lender?: string;
  principal?: string;
  interestBps?: number;
  duration?: number;
}): boolean {
  const expectedLoanId = idToBytes32(params.loanId).toLowerCase();
  const expectedShardId = params.shardId ? idToBytes32(params.shardId).toLowerCase() : null;

  for (const log of params.receipt.logs) {
    if (!log.address || !isAddressEqual(log.address, LOAN_VAULT_ADDRESS)) continue;
    try {
      const decoded = decodeEventLog({
        abi: LOAN_VAULT_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== params.eventName) continue;

      const args = decoded.args as Record<string, unknown>;
      const loanId = String(args.loanId ?? "").toLowerCase();
      if (loanId !== expectedLoanId) continue;

      if (params.eventName === "LoanListed") {
        if (String(args.shardId ?? "").toLowerCase() !== expectedShardId) continue;
        if (
          !params.borrower ||
          !isAddressEqual(args.borrower as `0x${string}`, normalizeAddress(params.borrower))
        ) continue;
        if (
          params.principal === undefined ||
          (args.principal as bigint) !== toBigIntStrict(params.principal)
        ) continue;
        if (
          params.interestBps === undefined ||
          (args.interestBps as bigint) !== BigInt(params.interestBps)
        ) continue;
        if (
          params.duration === undefined ||
          (args.duration as bigint) !== BigInt(params.duration)
        ) continue;
      }

      if (params.eventName === "LoanFunded") {
        if (!params.lender || !isAddressEqual(args.lender as `0x${string}`, normalizeAddress(params.lender))) {
          continue;
        }
      }

      if (params.eventName === "LoanLiquidated") {
        if (!params.lender || !isAddressEqual(args.lender as `0x${string}`, normalizeAddress(params.lender))) {
          continue;
        }
        if (expectedShardId && String(args.shardId ?? "").toLowerCase() !== expectedShardId) continue;
      }

      return true;
    } catch {
      // ignore unrelated logs
    }
  }
  return false;
}

export async function verifyCreateLoanTx(params: {
  txHash: string;
  expectedFrom: string;
  loanId: string;
  shardId: string;
  principal: string;
  interestBps: number;
  duration: number;
}): Promise<VerifyResult> {
  if (!LOAN_VAULT_CONFIGURED) {
    return { ok: false, error: "LoanVault contract is not configured" };
  }

  try {
    const hash = params.txHash as Hex;
    const [tx, receipt] = await Promise.all([
      publicClient.getTransaction({ hash }),
      publicClient.getTransactionReceipt({ hash }),
    ]);

    if (!tx.to || isAddressEqual(tx.to, ZERO_EVM_ADDRESS)) {
      return { ok: false, error: "Loan tx has no target contract" };
    }
    if (!isAddressEqual(tx.to, LOAN_VAULT_ADDRESS)) {
      return { ok: false, error: "Loan tx targets wrong contract" };
    }
    if (!isAddressEqual(tx.from, normalizeAddress(params.expectedFrom))) {
      return { ok: false, error: "Loan tx sender mismatch" };
    }
    if (receipt.status !== "success") {
      return { ok: false, error: "Loan tx failed on-chain" };
    }

    const decoded = decodeFunctionData({
      abi: LOAN_VAULT_ABI,
      data: tx.input,
    });

    if (decoded.functionName !== "createLoan") {
      return { ok: false, error: "Tx is not LoanVault.createLoan" };
    }

    const [loanId, shardId, principal, interestBps, duration] = decoded.args;
    if ((loanId as Hex).toLowerCase() !== idToBytes32(params.loanId).toLowerCase()) {
      return { ok: false, error: "createLoan loanId mismatch" };
    }
    if ((shardId as Hex).toLowerCase() !== idToBytes32(params.shardId).toLowerCase()) {
      return { ok: false, error: "createLoan shardId mismatch" };
    }
    if ((principal as bigint) !== toBigIntStrict(params.principal)) {
      return { ok: false, error: "createLoan principal mismatch" };
    }
    if ((interestBps as bigint) !== BigInt(params.interestBps)) {
      return { ok: false, error: "createLoan interest mismatch" };
    }
    if ((duration as bigint) !== BigInt(params.duration)) {
      return { ok: false, error: "createLoan duration mismatch" };
    }

    if (
      !receiptHasEvent({
        receipt,
        eventName: "LoanListed",
        loanId: params.loanId,
        shardId: params.shardId,
        borrower: params.expectedFrom,
        principal: params.principal,
        interestBps: params.interestBps,
        duration: params.duration,
      })
    ) {
      return { ok: false, error: "LoanListed event mismatch or missing" };
    }

    const chainLoan = await publicClient.readContract({
      address: LOAN_VAULT_ADDRESS,
      abi: LOAN_VAULT_ABI,
      functionName: "getLoan",
      args: [idToBytes32(params.loanId)],
    });
    if (!isAddressEqual(chainLoan.borrower, normalizeAddress(params.expectedFrom))) {
      return { ok: false, error: "On-chain loan borrower mismatch" };
    }
    if (chainLoan.state !== 1) {
      return { ok: false, error: "On-chain loan is not in Listed state" };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to verify createLoan tx on-chain" };
  }
}

export async function verifyLoanActionTx(params: {
  txHash: string;
  expectedFrom: string;
  loanId: string;
  action: "fund" | "repay" | "liquidate" | "cancel";
}): Promise<VerifyResult> {
  if (!LOAN_VAULT_CONFIGURED) {
    return { ok: false, error: "LoanVault contract is not configured" };
  }

  try {
    const hash = params.txHash as Hex;
    const [tx, receipt] = await Promise.all([
      publicClient.getTransaction({ hash }),
      publicClient.getTransactionReceipt({ hash }),
    ]);

    if (!tx.to || isAddressEqual(tx.to, ZERO_EVM_ADDRESS)) {
      return { ok: false, error: "Loan action tx has no target contract" };
    }
    if (!isAddressEqual(tx.to, LOAN_VAULT_ADDRESS)) {
      return { ok: false, error: "Loan action tx targets wrong contract" };
    }
    if (!isAddressEqual(tx.from, normalizeAddress(params.expectedFrom))) {
      return { ok: false, error: "Loan action tx sender mismatch" };
    }
    if (receipt.status !== "success") {
      return { ok: false, error: "Loan action tx failed on-chain" };
    }

    const decoded = decodeFunctionData({
      abi: LOAN_VAULT_ABI,
      data: tx.input,
    });

    const expectedFn =
      params.action === "fund"
        ? "fundLoan"
        : params.action === "repay"
          ? "repayLoan"
          : params.action === "liquidate"
            ? "liquidate"
            : "cancelLoan";

    if (decoded.functionName !== expectedFn) {
      return { ok: false, error: `Tx is not LoanVault.${expectedFn}` };
    }

    const [loanId] = decoded.args;
    if ((loanId as Hex).toLowerCase() !== idToBytes32(params.loanId).toLowerCase()) {
      return { ok: false, error: `${expectedFn} loanId mismatch` };
    }

    const expectedEvent =
      params.action === "fund"
        ? "LoanFunded"
        : params.action === "repay"
          ? "LoanRepaid"
          : params.action === "liquidate"
            ? "LoanLiquidated"
            : "LoanCancelled";

    const onChainLoan = await publicClient.readContract({
      address: LOAN_VAULT_ADDRESS,
      abi: LOAN_VAULT_ABI,
      functionName: "getLoan",
      args: [idToBytes32(params.loanId)],
    });

    const expectedState =
      params.action === "fund"
        ? 2
        : params.action === "repay"
          ? 3
          : params.action === "liquidate"
            ? 4
            : 5;
    if (onChainLoan.state !== expectedState) {
      return { ok: false, error: `On-chain loan is not in expected post-${params.action} state` };
    }
    if (
      params.action === "fund" &&
      !isAddressEqual(onChainLoan.lender, normalizeAddress(params.expectedFrom))
    ) {
      return { ok: false, error: "On-chain lender mismatch after fund" };
    }

    if (
      !receiptHasEvent({
        receipt,
        eventName: expectedEvent,
        loanId: params.loanId,
        lender: params.action === "fund" || params.action === "liquidate" ? params.expectedFrom : undefined,
      })
    ) {
      return { ok: false, error: `${expectedEvent} event mismatch or missing` };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to verify loan action tx on-chain" };
  }
}
