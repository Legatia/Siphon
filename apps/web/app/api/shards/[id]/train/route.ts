import { NextRequest, NextResponse } from "next/server";
import { getShardById, updateShardXp } from "@/lib/shard-engine";
import { generateShardResponse } from "@/lib/llm";
import { getDb } from "@/lib/db";
import { PROTOCOL_CONSTANTS } from "@siphon/core";
import { canSendMessage, incrementMessageCount } from "@/lib/subscription-check";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const messages = db
    .prepare(
      "SELECT * FROM training_messages WHERE shard_id = ? ORDER BY timestamp ASC LIMIT 100"
    )
    .all(params.id);

  return NextResponse.json(messages);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { message, sessionId } = body;

  if (!message) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  const shard = getShardById(params.id);
  if (!shard) {
    return NextResponse.json({ error: "Shard not found" }, { status: 404 });
  }

  // Check message cap for shard owner (Trainer+ has 1000/mo limit)
  const ownerId = shard.ownerId;
  if (ownerId) {
    const msgCheck = canSendMessage(ownerId);
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

  const db = getDb();

  // Get conversation history
  const history = db
    .prepare(
      "SELECT role, content FROM training_messages WHERE shard_id = ? AND session_id = ? ORDER BY timestamp ASC LIMIT 20"
    )
    .all(params.id, sessionId || "default") as { role: string; content: string }[];

  const chatHistory = history.map((m) => ({
    role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
    content: m.content,
  }));

  // Save user message
  const userMsgId = crypto.randomUUID();
  db.prepare(
    "INSERT INTO training_messages (id, session_id, shard_id, role, content, xp_gained, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(userMsgId, sessionId || "default", params.id, "user", message, 0, Date.now());

  // Generate AI response
  const response = await generateShardResponse(shard, chatHistory, message);

  // Save shard response and award XP
  const xpGained = PROTOCOL_CONSTANTS.XP_PER_INTERACTION;
  const shardMsgId = crypto.randomUUID();
  db.prepare(
    "INSERT INTO training_messages (id, session_id, shard_id, role, content, xp_gained, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(shardMsgId, sessionId || "default", params.id, "shard", response, xpGained, Date.now());

  // Update shard XP
  const updated = updateShardXp(params.id, xpGained);

  // Increment message count for capped tiers
  if (ownerId) {
    incrementMessageCount(ownerId);
  }

  return NextResponse.json({
    response,
    xpGained,
    shard: updated,
  });
}
