import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout — Clear session
 */
export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
