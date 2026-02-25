import { NextResponse } from "next/server";
import { dbAll } from "@/lib/db";
import { LoanState } from "@siphon/core";
import { publicClient, LOAN_VAULT_ABI, LOAN_VAULT_ADDRESS, idToBytes32 } from "@/lib/contracts";
import { isLendingEnabled } from "@/lib/features";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/liquidate
 * Scans all funded loans and checks on-chain if they are liquidatable.
 * Returns the list of liquidatable loans for lenders to act on.
 * Note: liquidate() is permissioned to the lender, so this cron only reports.
 */
export async function GET() {
  if (!isLendingEnabled()) {
    return NextResponse.json({
      liquidatable: [],
      checked: 0,
      disabled: true,
      reason: "Lending is disabled for this deployment",
    });
  }

  try {
    const fundedLoans = await dbAll<{
      id: string;
      borrower: string;
      lender: string;
      shard_id: string;
      principal: number;
    }>("SELECT * FROM loans WHERE state = ?", LoanState.Funded);

    if (fundedLoans.length === 0) {
      return NextResponse.json({ liquidatable: [], checked: 0 });
    }

    const liquidatable: Array<{
      loanId: string;
      borrower: string;
      lender: string;
      shardId: string;
      principal: number;
    }> = [];

    for (const loan of fundedLoans) {
      try {
        const loanIdBytes = idToBytes32(loan.id);
        const isLiquidatable = await publicClient.readContract({
          address: LOAN_VAULT_ADDRESS as `0x${string}`,
          abi: LOAN_VAULT_ABI,
          functionName: "isLiquidatable",
          args: [loanIdBytes],
        });

        if (isLiquidatable) {
          liquidatable.push({
            loanId: loan.id,
            borrower: loan.borrower,
            lender: loan.lender,
            shardId: loan.shard_id,
            principal: loan.principal,
          });
        }
      } catch (err) {
        // Skip loans that fail the on-chain check (e.g. not yet on-chain)
        console.error(`[cron/liquidate] Failed to check loan ${loan.id}:`, err);
      }
    }

    return NextResponse.json({
      liquidatable,
      checked: fundedLoans.length,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[cron/liquidate] Fatal error:", error);
    return NextResponse.json(
      { error: "Failed to check liquidations" },
      { status: 500 }
    );
  }
}
