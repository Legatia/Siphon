import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId } = await params;

  if (!tokenId) {
    return NextResponse.json(
      { error: "Missing tokenId" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { validatorId, result, evidence, txHash } = body;

    // Two-phase flow:
    // Phase 1: Client sends validatorId + result + evidence, no txHash
    //   → Return 202 with data needed for on-chain call
    // Phase 2: Client sends txHash to confirm on-chain completion
    //   → Return 200

    if (!txHash) {
      // Phase 1: Prepare validation data
      if (!validatorId || typeof result !== "boolean" || !evidence) {
        return NextResponse.json(
          {
            error:
              "Missing required fields: validatorId (string), result (boolean), evidence (string)",
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          needsOnChainValidation: true,
          tokenId,
          result,
          evidence,
          contractCall: {
            functionName: "addValidation",
            args: [BigInt(tokenId).toString(), result, evidence],
          },
        },
        { status: 202 }
      );
    }

    // Phase 2: Confirm on-chain completion
    return NextResponse.json({
      success: true,
      txHash,
      tokenId,
    });
  } catch (err) {
    console.error("[identity/validate] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
