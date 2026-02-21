import { NextRequest, NextResponse } from "next/server";
import { ensureAddressMatch, requireSessionAddress } from "@/lib/session-auth";
import { evaluateAchievements, listAchievements } from "@/lib/achievements";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSessionAddress();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const ownerId = (searchParams.get("ownerId") ?? auth.address).toLowerCase();
  const mismatch = ensureAddressMatch(auth.address, ownerId, "ownerId");
  if (mismatch) return mismatch;

  evaluateAchievements(ownerId);
  return NextResponse.json({
    ownerId,
    achievements: listAchievements(ownerId),
  });
}

