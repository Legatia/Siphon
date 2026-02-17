import { NextRequest, NextResponse } from "next/server";
import {
  createLoan,
  getLoans,
  getLoanListings,
  getActiveLoans,
} from "@/lib/loan-engine";
import { LoanState } from "@siphon/core";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const borrower = searchParams.get("borrower");
  const lender = searchParams.get("lender");
  const stateParam = searchParams.get("state");
  const view = searchParams.get("view"); // "listings" | "active"

  try {
    if (view === "listings") {
      return NextResponse.json(getLoanListings());
    }
    if (view === "active") {
      return NextResponse.json(getActiveLoans());
    }

    const state =
      stateParam !== null ? (parseInt(stateParam) as LoanState) : undefined;

    const loans = getLoans({
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
  try {
    const body = await request.json();
    const { id, shardId, borrower, principal, interestBps, duration, collateralValue, txHash } = body;

    if (!shardId || !borrower || !principal || interestBps === undefined || !duration) {
      return NextResponse.json(
        { error: "Missing required fields: shardId, borrower, principal, interestBps, duration" },
        { status: 400 }
      );
    }

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

    const loan = createLoan({
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
