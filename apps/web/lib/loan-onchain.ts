import { decodeFunctionData, type Hex, isAddressEqual } from "viem";
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

    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to verify loan action tx on-chain" };
  }
}
