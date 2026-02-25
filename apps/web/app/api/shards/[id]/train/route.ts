import { NextRequest, NextResponse } from "next/server";
import { getShardById, updateShardXp, improveShardStats } from "@/lib/shard-engine";
import { generateShardResponse } from "@/lib/llm";
import { dbRun, dbAll } from "@/lib/db";
import { PROTOCOL_CONSTANTS } from "@siphon/core";
import { canSendMessage, incrementMessageCount } from "@/lib/subscription-check";
import { requireSessionAddress } from "@/lib/session-auth";
import { logActivationEvent } from "@/lib/activation-analytics";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSessionAddress();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const shard = await getShardById(id);
  if (!shard) {
    return NextResponse.json({ error: "Shard not found" }, { status: 404 });
  }
  if (shard.ownerId && shard.ownerId.toLowerCase() !== auth.address) {
    return NextResponse.json(
      { error: "Only the shard owner can view training history" },
      { status: 403 }
    );
  }

  const messages = await dbAll(
    "SELECT * FROM training_messages WHERE shard_id = ? ORDER BY timestamp ASC LIMIT 100",
    id
  );

  return NextResponse.json(messages);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSessionAddress();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const { message, sessionId } = body;

  if (!message) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  const shard = await getShardById(id);
  if (!shard) {
    return NextResponse.json({ error: "Shard not found" }, { status: 404 });
  }

  if (shard.ownerId && shard.ownerId.toLowerCase() !== auth.address) {
    return NextResponse.json(
      { error: "Only the shard owner can train this shard" },
      { status: 403 }
    );
  }

  // Check message cap for shard owner (Trainer+ has 1000/mo limit)
  const ownerId = shard.ownerId;
  if (ownerId) {
    const msgCheck = await canSendMessage(ownerId);
    if (!msgCheck.allowed) {
      return NextResponse.json(
        {
          error: msgCheck.reason,
          messagesRemaining: 0,
        },
        { status: 429 }
      );
    }
  }

  // Get conversation history
  const history = await dbAll<{ role: string; content: string }>(
    "SELECT role, content FROM training_messages WHERE shard_id = ? AND session_id = ? ORDER BY timestamp ASC LIMIT 20",
    id, sessionId || "default"
  );

  const chatHistory = history.map((m) => ({
    role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
    content: m.content,
  }));

  // Save user message
  const userMsgId = crypto.randomUUID();
  await dbRun(
    "INSERT INTO training_messages (id, session_id, shard_id, role, content, xp_gained, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
    userMsgId, sessionId || "default", id, "user", message, 0, Date.now()
  );

  // Generate AI response
  const response = await generateShardResponse(shard, chatHistory, message);

  // Save shard response and award XP
  const xpGained = PROTOCOL_CONSTANTS.XP_PER_INTERACTION;
  const shardMsgId = crypto.randomUUID();
  await dbRun(
    "INSERT INTO training_messages (id, session_id, shard_id, role, content, xp_gained, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
    shardMsgId, sessionId || "default", id, "shard", response, xpGained, Date.now()
  );

  // Update shard XP and stats
  const updated = await updateShardXp(id, xpGained);
  const withStats = await improveShardStats(id);

  // Increment message count for capped tiers
  if (ownerId) {
    await incrementMessageCount(ownerId);
    await logActivationEvent({
      ownerId,
      eventType: "trained",
      source: "api:shards/train",
      entityId: id,
      uniqueKey: `${ownerId.toLowerCase()}:trained:${id}`,
      metadata: { xpGained, sessionId: sessionId || "default" },
    });
  }

  return NextResponse.json({
    response,
    xpGained,
    shard: withStats ?? updated,
  });
}
