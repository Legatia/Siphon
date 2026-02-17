import { getDb } from "./db";
import { getShardLimit, getMessageCap, TIER_PRICES } from "./stripe";

interface SubscriptionInfo {
  tier: string;
  shardLimit: number;
  messageCap: number;
  messageCount: number;
  hostingType: string;
  stakeAmount: number;
}

function getMonthStart(): number {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Get user's subscription info, creating a free_trainer record if none exists */
export function getUserSubscription(userId: string): SubscriptionInfo {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT * FROM subscriptions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1"
    )
    .get(userId) as Record<string, unknown> | undefined;

  if (!row) {
    return {
      tier: "free_trainer",
      shardLimit: 0,
      messageCap: -1,
      messageCount: 0,
      hostingType: "none",
      stakeAmount: 0,
    };
  }

  const tier = row.tier as string;
  let messageCount = (row.message_count as number) ?? 0;

  // Reset message count if new month
  const lastReset = (row.last_message_reset as number) ?? 0;
  const monthStart = getMonthStart();
  if (lastReset < monthStart) {
    db.prepare(
      "UPDATE subscriptions SET message_count = 0, last_message_reset = ? WHERE user_id = ?"
    ).run(monthStart, userId);
    messageCount = 0;
  }

  return {
    tier,
    shardLimit: getShardLimit(tier),
    messageCap: getMessageCap(tier),
    messageCount,
    hostingType: (row.hosting_type as string) ?? "none",
    stakeAmount: (row.stake_amount as number) ?? 0,
  };
}

/** Get count of shards owned by user */
export function getOwnedShardCount(userId: string): number {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT COUNT(*) as count FROM shards WHERE owner_id = ? AND is_wild = 0"
    )
    .get(userId) as { count: number };
  return row.count;
}

/** Check if user can own another shard */
export function canOwnMoreShards(
  userId: string
): { allowed: boolean; reason?: string } {
  const sub = getUserSubscription(userId);

  if (sub.shardLimit === 0) {
    return {
      allowed: false,
      reason:
        "Free Trainers cannot own Shards. Upgrade to Trainer+ to own up to 3.",
    };
  }

  if (sub.shardLimit === -1) {
    return { allowed: true };
  }

  const owned = getOwnedShardCount(userId);
  if (owned >= sub.shardLimit) {
    return {
      allowed: false,
      reason: `Shard ownership limit reached (${owned}/${sub.shardLimit}). Upgrade your tier for more slots.`,
    };
  }

  return { allowed: true };
}

/** Check if user can send a training message (and increment count if yes) */
export function canSendMessage(
  userId: string
): { allowed: boolean; reason?: string; remaining?: number } {
  const sub = getUserSubscription(userId);

  // Unlimited
  if (sub.messageCap === -1) {
    return { allowed: true, remaining: -1 };
  }

  if (sub.messageCount >= sub.messageCap) {
    return {
      allowed: false,
      reason: `Monthly message limit reached (${sub.messageCap}). Upgrade to Keeper for unlimited messages.`,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    remaining: sub.messageCap - sub.messageCount - 1,
  };
}

/** Increment the message counter for a user */
export function incrementMessageCount(userId: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE subscriptions SET message_count = message_count + 1 WHERE user_id = ?"
  ).run(userId);
}
