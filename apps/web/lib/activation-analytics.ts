import crypto from "crypto";
import { dbRun, dbAll } from "@/lib/db";

export type ActivationEventType =
  | "captured"
  | "trained"
  | "battled"
  | "claimed_bounty"
  | "completed_bounty";

const FUNNEL_STEPS: ActivationEventType[] = [
  "captured",
  "trained",
  "battled",
  "claimed_bounty",
  "completed_bounty",
];

export async function logActivationEvent(input: {
  ownerId: string;
  eventType: ActivationEventType;
  source: string;
  entityId?: string | null;
  uniqueKey?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: number;
}) {
  await dbRun(
    `INSERT OR IGNORE INTO activation_events
      (id, owner_id, event_type, source, entity_id, unique_key, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    crypto.randomUUID(),
    input.ownerId.toLowerCase(),
    input.eventType,
    input.source,
    input.entityId ?? null,
    input.uniqueKey ?? null,
    input.metadata ? JSON.stringify(input.metadata) : null,
    input.createdAt ?? Date.now()
  );
}

export async function getActivationFunnel(params?: {
  ownerId?: string;
  sinceMs?: number;
  untilMs?: number;
}) {
  const where: string[] = [];
  const args: Array<string | number> = [];

  if (params?.ownerId) {
    where.push("owner_id = ?");
    args.push(params.ownerId.toLowerCase());
  }
  if (params?.sinceMs) {
    where.push("created_at >= ?");
    args.push(params.sinceMs);
  }
  if (params?.untilMs) {
    where.push("created_at <= ?");
    args.push(params.untilMs);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await dbAll<{
    owner_id: string;
    event_type: ActivationEventType;
    first_at: number;
  }>(
    `SELECT owner_id, event_type, MIN(created_at) as first_at
     FROM activation_events
     ${whereSql}
     GROUP BY owner_id, event_type`,
    ...args
  );

  const stepOwners = new Map<ActivationEventType, Set<string>>();
  const firstAtByStep = new Map<ActivationEventType, number>();
  for (const step of FUNNEL_STEPS) {
    stepOwners.set(step, new Set());
  }

  for (const row of rows) {
    if (!stepOwners.has(row.event_type)) continue;
    stepOwners.get(row.event_type)!.add(row.owner_id);
    const prev = firstAtByStep.get(row.event_type);
    if (prev === undefined || row.first_at < prev) {
      firstAtByStep.set(row.event_type, row.first_at);
    }
  }

  const counts = FUNNEL_STEPS.map((step) => ({
    step,
    users: stepOwners.get(step)!.size,
    firstAt: firstAtByStep.get(step) ?? null,
  }));

  const base = counts[0]?.users ?? 0;
  const withConversion = counts.map((row, idx) => {
    const prev = idx === 0 ? row.users : counts[idx - 1]!.users;
    return {
      ...row,
      conversionFromPrevious: prev > 0 ? Number((row.users / prev).toFixed(4)) : null,
      conversionFromStart: base > 0 ? Number((row.users / base).toFixed(4)) : null,
    };
  });

  return {
    totals: {
      uniqueUsers: new Set(rows.map((r) => r.owner_id)).size,
      events: rows.length,
    },
    steps: withConversion,
  };
}

export async function getActivationEvents(params?: {
  ownerId?: string;
  eventType?: ActivationEventType;
  sinceMs?: number;
  untilMs?: number;
  limit?: number;
}) {
  const where: string[] = [];
  const args: Array<string | number> = [];

  if (params?.ownerId) {
    where.push("owner_id = ?");
    args.push(params.ownerId.toLowerCase());
  }
  if (params?.eventType) {
    where.push("event_type = ?");
    args.push(params.eventType);
  }
  if (params?.sinceMs) {
    where.push("created_at >= ?");
    args.push(params.sinceMs);
  }
  if (params?.untilMs) {
    where.push("created_at <= ?");
    args.push(params.untilMs);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(Math.max(params?.limit ?? 100, 1), 1000);

  return dbAll(
    `SELECT id, owner_id, event_type, source, entity_id, metadata_json, created_at
     FROM activation_events
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT ${limit}`,
    ...args
  );
}
