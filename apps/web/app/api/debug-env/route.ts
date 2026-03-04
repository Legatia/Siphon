import { NextResponse } from "next/server";

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
    "SESSION_SECRET",
  ];

  const result: Record<string, string> = {};
  for (const key of keys) {
    const val = process.env[key];
    if (!val) {
      result[key] = "MISSING";
    } else if (key.includes("SECRET") || key.includes("TOKEN") || key.includes("API_KEY")) {
      result[key] = val.slice(0, 6) + "...";
    } else {
      result[key] = val;
    }
  }

  return NextResponse.json(result);
}
