import { NextRequest, NextResponse } from "next/server";
import type { ReputationEntry } from "@siphon/core";
import {
  publicClient,
  ERC8004_IDENTITY_ABI,
  ERC8004_IDENTITY_ADDRESS,
} from "@/lib/contracts";

export async function GET(
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

  let reputation = 0;
  let validationCount = 0;

  try {
    const rep = await publicClient.readContract({
      address: ERC8004_IDENTITY_ADDRESS as `0x${string}`,
      abi: ERC8004_IDENTITY_ABI,
      functionName: "getReputation",
      args: [BigInt(tokenId)],
    });
    reputation = Number(rep);

    const agent = await publicClient.readContract({
      address: ERC8004_IDENTITY_ADDRESS as `0x${string}`,
      abi: ERC8004_IDENTITY_ABI,
      functionName: "getAgent",
      args: [BigInt(tokenId)],
    }) as any;
    validationCount = Number(agent.validationCount ?? 0);
  } catch {
    // Contract not deployed or tokenId doesn't exist — return defaults
  }

  const result: {
    tokenId: string;
    reputation: number;
    validationCount: number;
    history: ReputationEntry[];
  } = {
    tokenId,
    reputation,
    validationCount,
    history: [],
  };

  return NextResponse.json(result);
}
