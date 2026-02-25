import { NextRequest, NextResponse } from "next/server";
import {
  getActivationEvents,
  getActivationFunnel,
  logActivationEvent,
  type ActivationEventType,
} from "@/lib/activation-analytics";
import { ensureAddressMatch, requireSessionAddress } from "@/lib/session-auth";

const ADMIN_ALLOWLIST = (process.env.ANALYTICS_ADMIN_ADDRESSES ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isAdmin(address: string): boolean {
  return ADMIN_ALLOWLIST.includes(address.toLowerCase());
}

export async function GET(request: NextRequest) {
  const auth = await requireSessionAddress();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const scope = (searchParams.get("scope") ?? "me").toLowerCase();
  const ownerId = searchParams.get("ownerId") ?? auth.address;
  const days = Math.max(1, Math.min(365, Number(searchParams.get("days") ?? "30")));
  const includeEvents = searchParams.get("includeEvents") === "1";
  const endMsRaw = Number(searchParams.get("endMs") ?? Date.now());
  const endMs = Number.isFinite(endMsRaw) ? Math.max(0, endMsRaw) : Date.now();
  const sinceMs = endMs - days * 24 * 60 * 60 * 1000;

  if (scope !== "global") {
    const mismatch = ensureAddressMatch(auth.address, ownerId, "ownerId");
    if (mismatch) return mismatch;
  } else if (!isAdmin(auth.address)) {
    return NextResponse.json(
      { error: "Global analytics access requires admin allowlist" },
      { status: 403 }
    );
  }

  const funnel = await getActivationFunnel({
    ownerId: scope === "global" ? undefined : ownerId,
    sinceMs,
    untilMs: endMs,
  });

  const events = includeEvents
    ? await getActivationEvents({
        ownerId: scope === "global" ? undefined : ownerId,
        sinceMs,
        untilMs: endMs,
        limit: 200,
      })
    : undefined;

  return NextResponse.json({
    scope,
    ownerId: scope === "global" ? null : ownerId.toLowerCase(),
    windowDays: days,
    windowEndMs: endMs,
    funnel,
    events,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireSessionAddress();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const eventType = body?.eventType as ActivationEventType | undefined;
  if (!eventType) {
    return NextResponse.json({ error: "Missing eventType" }, { status: 400 });
  }

  await logActivationEvent({
    ownerId: auth.address,
    eventType,
    source: String(body?.source ?? "client"),
    entityId: body?.entityId ? String(body.entityId) : undefined,
    uniqueKey: body?.uniqueKey ? String(body.uniqueKey) : undefined,
    metadata:
      body?.metadata && typeof body.metadata === "object"
        ? (body.metadata as Record<string, unknown>)
        : undefined,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
