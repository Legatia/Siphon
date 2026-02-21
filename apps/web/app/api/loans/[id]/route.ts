import { NextRequest, NextResponse } from "next/server";
import {
  getLoan,
  fundLoan,
  repayLoan,
  liquidateLoan,
  cancelLoan,
} from "@/lib/loan-engine";
import { requireSessionAddress } from "@/lib/session-auth";
import { verifyLoanActionTx } from "@/lib/loan-onchain";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const loan = getLoan(id);

  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  return NextResponse.json(loan);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { action, lender, txHash } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Missing action field (fund | repay | liquidate | cancel)" },
        { status: 400 }
      );
    }
    if (!txHash) {
      return NextResponse.json(
        { error: "txHash is required for all loan actions" },
        { status: 400 }
      );
    }

    let loan;

    switch (action) {
      case "fund": {
        if (!lender) {
          return NextResponse.json(
            { error: "Lender address required" },
            { status: 400 }
          );
        }
        if (auth.address !== lender.toLowerCase()) {
          return NextResponse.json(
            { error: "Caller does not match lender address" },
            { status: 403 }
          );
        }
        const verified = await verifyLoanActionTx({
          txHash,
          expectedFrom: auth.address,
          loanId: id,
          action: "fund",
        });
        if (!verified.ok) {
          return NextResponse.json({ error: verified.error }, { status: 400 });
        }
        loan = fundLoan(id, lender, txHash);
        break;
      }

      case "repay": {
        // Verify the caller is the borrower
        const loanToRepay = getLoan(id);
        if (!loanToRepay) {
          return NextResponse.json(
            { error: "Loan not found" },
            { status: 404 }
          );
        }
        if (auth.address !== loanToRepay.borrower.toLowerCase()) {
          return NextResponse.json(
            { error: "Only the borrower can repay this loan" },
            { status: 403 }
          );
        }
        const verified = await verifyLoanActionTx({
          txHash,
          expectedFrom: auth.address,
          loanId: id,
          action: "repay",
        });
        if (!verified.ok) {
          return NextResponse.json({ error: verified.error }, { status: 400 });
        }
        loan = repayLoan(id, txHash);
        break;
      }

      case "liquidate": {
        // Verify the caller is the lender
        const loanToLiquidate = getLoan(id);
        if (!loanToLiquidate) {
          return NextResponse.json(
            { error: "Loan not found" },
            { status: 404 }
          );
        }
        if (auth.address !== loanToLiquidate.lender?.toLowerCase()) {
          return NextResponse.json(
            { error: "Only the lender can liquidate this loan" },
            { status: 403 }
          );
        }
        const verified = await verifyLoanActionTx({
          txHash,
          expectedFrom: auth.address,
          loanId: id,
          action: "liquidate",
        });
        if (!verified.ok) {
          return NextResponse.json({ error: verified.error }, { status: 400 });
        }
        loan = liquidateLoan(id, txHash);
        break;
      }

      case "cancel": {
        // Verify the caller is the borrower
        const existing = getLoan(id);
        if (!existing) {
          return NextResponse.json(
            { error: "Loan not found" },
            { status: 404 }
          );
        }
        if (auth.address !== existing.borrower.toLowerCase()) {
          return NextResponse.json(
            { error: "Only the borrower can cancel this loan" },
            { status: 403 }
          );
        }
        const verified = await verifyLoanActionTx({
          txHash,
          expectedFrom: auth.address,
          loanId: id,
          action: "cancel",
        });
        if (!verified.ok) {
          return NextResponse.json({ error: verified.error }, { status: 400 });
        }
        loan = cancelLoan(id);
        break;
      }

      default:
        return NextResponse.json(
          { error: "Invalid action. Must be: fund, repay, liquidate, cancel" },
          { status: 400 }
        );
    }

    return NextResponse.json(loan);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update loan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
