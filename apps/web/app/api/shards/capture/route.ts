import { NextRequest, NextResponse } from "next/server";
import { getShardById, captureShard } from "@/lib/shard-engine";
import { generateChallenge, evaluateAnswer } from "@siphon/core";
import { canOwnMoreShards } from "@/lib/subscription-check";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { shardId, answer, ownerId } = body;

  if (!shardId || !ownerId) {
    return NextResponse.json({ error: "Missing shardId or ownerId" }, { status: 400 });
  }

  const shard = getShardById(shardId);
  if (!shard) {
    return NextResponse.json({ error: "Shard not found" }, { status: 404 });
  }

  if (!shard.isWild) {
    return NextResponse.json({ error: "Shard is not wild" }, { status: 400 });
  }

  // Check ownership limit before generating challenge
  const ownershipCheck = canOwnMoreShards(ownerId);
  if (!ownershipCheck.allowed) {
    return NextResponse.json(
      { error: ownershipCheck.reason },
      { status: 403 }
    );
  }

  // If no answer provided, generate and return the challenge
  if (!answer) {
    const challenge = generateChallenge(shard);
    return NextResponse.json({ challenge });
  }

  // Evaluate the answer
  const challenge = generateChallenge(shard);
  const result = evaluateAnswer(challenge, answer);

  if (result.success) {
    // Re-check ownership limit (could have changed between challenge and answer)
    const finalCheck = canOwnMoreShards(ownerId);
    if (!finalCheck.allowed) {
      return NextResponse.json(
        { error: finalCheck.reason },
        { status: 403 }
      );
    }

    const captured = captureShard(shardId, ownerId);

    return NextResponse.json({
      success: true,
      score: result.score,
      feedback: result.feedback,
      shard: captured,
      // Signal that on-chain registration is needed
      needsOnChainRegistration: true,
    });
  }

  return NextResponse.json({
    success: false,
    score: result.score,
    feedback: result.feedback,
  });
}
