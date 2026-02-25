import { NextRequest, NextResponse } from "next/server";
import { getShardById, captureShard } from "@/lib/shard-engine";
import { generateChallenge, evaluateAnswer } from "@siphon/core";
import { canOwnMoreShards } from "@/lib/subscription-check";
import { ensureAddressMatch, requireSessionAddress } from "@/lib/session-auth";
import { dbRun, dbGet } from "@/lib/db";
import { evaluateAchievements } from "@/lib/achievements";
import { logActivationEvent } from "@/lib/activation-analytics";

export async function POST(request: NextRequest) {
  const auth = await requireSessionAddress();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const { shardId, answer, ownerId, challengeId } = body;

  if (!shardId || !ownerId) {
    return NextResponse.json({ error: "Missing shardId or ownerId" }, { status: 400 });
  }

  const mismatch = ensureAddressMatch(auth.address, ownerId, "ownerId");
  if (mismatch) return mismatch;

  const shard = await getShardById(shardId);
  if (!shard) {
    return NextResponse.json({ error: "Shard not found" }, { status: 404 });
  }

  if (!shard.isWild) {
    return NextResponse.json({ error: "Shard is not wild" }, { status: 400 });
  }

  // Check ownership limit before generating challenge
  const ownershipCheck = await canOwnMoreShards(ownerId);
  if (!ownershipCheck.allowed) {
    return NextResponse.json(
      { error: ownershipCheck.reason },
      { status: 403 }
    );
  }

  // If no answer provided, generate and return a new challenge session
  if (!answer) {
    const challenge = generateChallenge(shard, crypto.randomUUID());
    const id = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + challenge.timeLimitMs;

    await dbRun(
      `INSERT INTO capture_sessions (id, shard_id, owner_id, challenge_json, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id, shardId, ownerId, JSON.stringify(challenge), expiresAt, now
    );

    const { expectedAnswer, ...safeChallenge } = challenge;
    return NextResponse.json({ challenge: safeChallenge, challengeId: id });
  }

  if (!challengeId) {
    return NextResponse.json(
      { error: "Missing challengeId for answer submission" },
      { status: 400 }
    );
  }

  const session = await dbGet<{ challenge_json: string; expires_at: number }>(
    `SELECT challenge_json, expires_at
     FROM capture_sessions
     WHERE id = ? AND shard_id = ? AND owner_id = ?`,
    challengeId, shardId, ownerId
  );

  if (!session) {
    return NextResponse.json(
      { error: "Capture challenge expired or invalid" },
      { status: 400 }
    );
  }

  if (Date.now() > session.expires_at) {
    await dbRun("DELETE FROM capture_sessions WHERE id = ?", challengeId);
    return NextResponse.json(
      { error: "Time's up! The Shard drifted away." },
      { status: 400 }
    );
  }

  // Evaluate the answer
  const challenge = JSON.parse(session.challenge_json);
  const result = evaluateAnswer(challenge, answer);

  await dbRun("DELETE FROM capture_sessions WHERE id = ?", challengeId);

  if (result.success) {
    // Re-check ownership limit (could have changed between challenge and answer)
    const finalCheck = await canOwnMoreShards(ownerId);
    if (!finalCheck.allowed) {
      return NextResponse.json(
        { error: finalCheck.reason },
        { status: 403 }
      );
    }

    const captured = await captureShard(shardId, ownerId);
    await evaluateAchievements(ownerId.toLowerCase());
    await logActivationEvent({
      ownerId,
      eventType: "captured",
      source: "api:shards/capture",
      entityId: shardId,
      uniqueKey: `${ownerId.toLowerCase()}:captured:${shardId}`,
      metadata: { challengeType: challenge.type, score: result.score },
    });

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
