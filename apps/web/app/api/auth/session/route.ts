import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/session — Check current session
 */
export async function GET() {
  const address = await getSession();

  if (!address) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({ authenticated: true, address });
}
