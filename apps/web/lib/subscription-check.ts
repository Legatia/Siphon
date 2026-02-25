import { dbGet, dbRun } from "./db";
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
export async function getUserSubscription(userId: string): Promise<SubscriptionInfo> {
  const row = await dbGet<Record<string, unknown>>(
    "SELECT * FROM subscriptions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
    userId
  );

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
    await dbRun(
      "UPDATE subscriptions SET message_count = 0, last_message_reset = ? WHERE user_id = ?",
      monthStart,
      userId
    );
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
export async function getOwnedShardCount(userId: string): Promise<number> {
  const row = await dbGet<{ count: number }>(
    "SELECT COUNT(*) as count FROM shards WHERE owner_id = ? AND is_wild = 0",
    userId
  );
  return row?.count ?? 0;
}

/** Check if user can own another shard */
export async function canOwnMoreShards(
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const sub = await getUserSubscription(userId);

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

  const owned = await getOwnedShardCount(userId);
  if (owned >= sub.shardLimit) {
    return {
      allowed: false,
      reason: `Shard ownership limit reached (${owned}/${sub.shardLimit}). Upgrade your tier for more slots.`,
    };
  }

  return { allowed: true };
}

/** Check if user can send a training message (and increment count if yes) */
export async function canSendMessage(
  userId: string
): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  const sub = await getUserSubscription(userId);

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
export async function incrementMessageCount(userId: string): Promise<void> {
  await dbRun(
    "UPDATE subscriptions SET message_count = message_count + 1 WHERE user_id = ?",
    userId
  );
}
