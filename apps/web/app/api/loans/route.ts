import { NextRequest, NextResponse } from "next/server";
import {
  createLoan,
  findLoanTxUsage,
  getLoan,
  getLoans,
  getLoanListings,
  getActiveLoans,
} from "@/lib/loan-engine";
import { LoanState } from "@siphon/core";
import { ensureAddressMatch, requireSessionAddress } from "@/lib/session-auth";
import { verifyCreateLoanTx } from "@/lib/loan-onchain";
import { isLendingEnabled } from "@/lib/features";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isLendingEnabled()) {
    return NextResponse.json(
      { error: "Lending is disabled for this deployment" },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(request.url);
  const borrower = searchParams.get("borrower");
  const lender = searchParams.get("lender");
  const stateParam = searchParams.get("state");
  const view = searchParams.get("view"); // "listings" | "active"

  try {
    if (view === "listings") {
      return NextResponse.json(await getLoanListings());
    }
    if (view === "active") {
      return NextResponse.json(await getActiveLoans());
    }

    const state =
      stateParam !== null ? (parseInt(stateParam) as LoanState) : undefined;

    const loans = await getLoans({
      borrower: borrower ?? undefined,
      lender: lender ?? undefined,
      state,
    });
    return NextResponse.json(loans);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch loans" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isLendingEnabled()) {
    return NextResponse.json(
      { error: "Lending is disabled for this deployment" },
      { status: 404 }
    );
  }

  try {
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { id, shardId, borrower, principal, interestBps, duration, collateralValue, txHash } = body;

    if (!id || !shardId || !borrower || !principal || interestBps === undefined || !duration || !txHash) {
      return NextResponse.json(
        { error: "Missing required fields: id, shardId, borrower, principal, interestBps, duration, txHash" },
        { status: 400 }
      );
    }

    const mismatch = ensureAddressMatch(auth.address, borrower, "borrower");
    if (mismatch) return mismatch;

    if (interestBps < 0 || interestBps > 5000) {
      return NextResponse.json(
        { error: "Interest must be 0-5000 basis points" },
        { status: 400 }
      );
    }

    if (duration < 3600 || duration > 31536000) {
      return NextResponse.json(
        { error: "Duration must be 1 hour to 365 days (in seconds)" },
        { status: 400 }
      );
    }

    const txUsage = await findLoanTxUsage(txHash);
    if (txUsage) {
      if (txUsage.loanId === id && txUsage.column === "tx_hash") {
        const existing = await getLoan(id);
        if (existing) return NextResponse.json(existing, { status: 200 });
      }
      return NextResponse.json(
        { error: `txHash already used by loan sync (${txUsage.loanId}:${txUsage.column})` },
        { status: 409 }
      );
    }

    const verified = await verifyCreateLoanTx({
      txHash,
      expectedFrom: auth.address,
      loanId: id,
      shardId,
      principal,
      interestBps,
      duration,
    });
    if (!verified.ok) {
      return NextResponse.json(
        { error: verified.error },
        { status: 400 }
      );
    }

    const loan = await createLoan({
      id,
      shardId,
      borrower,
      principal,
      interestBps,
      duration,
      collateralValue: collateralValue ?? principal,
      txHash,
    });

    return NextResponse.json(loan, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create loan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
