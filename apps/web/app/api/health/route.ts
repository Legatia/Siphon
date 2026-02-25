import { NextResponse } from "next/server";
import { dbGet, getDbRuntimeInfo } from "@/lib/db";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

export const dynamic = "force-dynamic";

interface HealthCheck {
  status: "ok" | "degraded" | "down";
  timestamp: number;
  checks: {
    database: { status: "ok" | "error"; latencyMs?: number; error?: string; mode?: "remote" | "local"; url?: string };
    chain: { status: "ok" | "error"; blockNumber?: number; error?: string };
    llm: { status: "ok" | "unavailable" | "not_configured"; model?: string };
  };
}

export async function GET() {
  const result: HealthCheck = {
    status: "ok",
    timestamp: Date.now(),
    checks: {
      database: { status: "ok" },
      chain: { status: "ok" },
      llm: { status: "ok" },
    },
  };

  // 1. Database check
  try {
    const start = Date.now();
    await dbGet<{ count: number }>("SELECT COUNT(*) as count FROM shards");
    const runtime = getDbRuntimeInfo();
    result.checks.database = {
      status: "ok",
      latencyMs: Date.now() - start,
      mode: runtime.mode,
      url: runtime.url,
    };
    if (process.env.NODE_ENV === "production" && runtime.mode === "local") {
      result.status = "degraded";
    }
  } catch (err) {
    result.checks.database = {
      status: "error",
      error: err instanceof Error ? err.message : "Database unreachable",
    };
    result.status = "degraded";
  }

  // 2. Chain connectivity check
  try {
    const client = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });
    const blockNumber = await client.getBlockNumber();
    result.checks.chain = {
      status: "ok",
      blockNumber: Number(blockNumber),
    };
  } catch (err) {
    result.checks.chain = {
      status: "error",
      error: err instanceof Error ? err.message : "Chain unreachable",
    };
    result.status = "degraded";
  }

  // 3. LLM availability check
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "";
  const baseURL = process.env.LLM_BASE_URL || "";
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const isLocal = baseURL.includes("localhost") || baseURL.includes("127.0.0.1");

  if (!apiKey && !isLocal) {
    result.checks.llm = { status: "not_configured" };
    // LLM not configured isn't "down" — fallback responses work
  } else {
    result.checks.llm = { status: "ok", model };
  }

  const httpStatus = result.status === "down" ? 503 : result.status === "degraded" ? 200 : 200;

  return NextResponse.json(result, { status: httpStatus });
}
