import { NextRequest, NextResponse } from "next/server";
import { ensureAddressMatch, requireSessionAddress } from "@/lib/session-auth";
import { ERC8004_IDENTITY_CONFIGURED } from "@/lib/contracts";
import { verifyIdentityTx } from "@/lib/identity-onchain";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const auth = await requireSessionAddress();
  if ("error" in auth) return auth.error;

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

    if (validatorId) {
      const mismatch = ensureAddressMatch(auth.address, validatorId, "validatorId");
      if (mismatch) return mismatch;
    }

    // Two-phase flow:
    // Phase 1: Client sends validatorId + result + evidence, no txHash
    //   → Return 202 with data needed for on-chain call
    // Phase 2: Client sends txHash to confirm on-chain completion
    //   → Return 200

    if (!txHash) {
      if (!ERC8004_IDENTITY_CONFIGURED) {
        return NextResponse.json(
          { error: "ERC8004 identity contract is not configured" },
          { status: 503 }
        );
      }

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
    const verified = await verifyIdentityTx(txHash, auth.address as `0x${string}`);
    if (!verified.ok) {
      return NextResponse.json(
        { error: verified.error },
        { status: 400 }
      );
    }

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
