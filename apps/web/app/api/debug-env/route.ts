import { NextResponse } from "next/server";
import { getDb, getDbRuntimeInfo } from "@/lib/db";

export async function GET() {
  const keys = [
    "NEXT_PUBLIC_SHARD_REGISTRY_ADDRESS",
    "NEXT_PUBLIC_KEEPER_STAKING_ADDRESS",
    "NEXT_PUBLIC_BATTLE_SETTLEMENT_ADDRESS",
    "NEXT_PUBLIC_SIPHON_IDENTITY_ADDRESS",
    "NEXT_PUBLIC_SHARD_VALUATION_ADDRESS",
    "NEXT_PUBLIC_LOAN_VAULT_ADDRESS",
    "NEXT_PUBLIC_SUBSCRIPTION_STAKING_ADDRESS",
    "NEXT_PUBLIC_SHARD_MARKETPLACE_ADDRESS",
    "NEXT_PUBLIC_SWARM_REGISTRY_ADDRESS",
    "NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS",
    "NEXT_PUBLIC_SUMMON_ESCROW_ADDRESS",
    "NEXT_PUBLIC_CHAIN_ID",
    "LLM_BASE_URL",
    "LLM_MODEL",
    "TURSO_DB_URL",
    "TURSO_AUTH_TOKEN",
    "SESSION_SECRET",
  ];

  const env: Record<string, string> = {};
  for (const key of keys) {
    const val = process.env[key];
    if (!val) {
      env[key] = "MISSING";
    } else if (key.includes("SECRET") || key.includes("TOKEN") || key.includes("API_KEY")) {
      env[key] = val.slice(0, 6) + "...";
    } else {
      env[key] = val;
    }
  }

  // Test database connection
  let dbStatus: string;
  let dbInfo = getDbRuntimeInfo();
  try {
    const db = await getDb();
    const rs = await db.execute("SELECT COUNT(*) as cnt FROM shards");
    const cnt = rs.rows[0]?.cnt ?? 0;
    dbStatus = `OK (${cnt} shards, mode=${dbInfo.mode})`;
  } catch (err) {
    dbStatus = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json({ env, db: { status: dbStatus, url: dbInfo.url, mode: dbInfo.mode } });
}
