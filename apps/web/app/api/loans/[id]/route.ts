import { NextRequest, NextResponse } from "next/server";
import {
  getLoan,
  fundLoan,
  repayLoan,
  liquidateLoan,
  cancelLoan,
} from "@/lib/loan-engine";

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
    const body = await request.json();
    const { action, lender, caller, txHash } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Missing action field (fund | repay | liquidate | cancel)" },
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
        // Verify the caller is the lender (prevent spoofing lender address)
        if (caller && caller.toLowerCase() !== lender.toLowerCase()) {
          return NextResponse.json(
            { error: "Caller does not match lender address" },
            { status: 403 }
          );
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
        if (!caller || caller.toLowerCase() !== loanToRepay.borrower.toLowerCase()) {
          return NextResponse.json(
            { error: "Only the borrower can repay this loan" },
            { status: 403 }
          );
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
        if (!caller || caller.toLowerCase() !== loanToLiquidate.lender?.toLowerCase()) {
          return NextResponse.json(
            { error: "Only the lender can liquidate this loan" },
            { status: 403 }
          );
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
        if (!caller || caller.toLowerCase() !== existing.borrower.toLowerCase()) {
          return NextResponse.json(
            { error: "Only the borrower can cancel this loan" },
            { status: 403 }
          );
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
