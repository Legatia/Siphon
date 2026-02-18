import { NextResponse } from "next/server";
import { generateNonce } from "@/lib/auth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/nonce — Generate a nonce for SIWE signing
 */
export async function GET() {
  const nonce = generateNonce();

  // Store nonce in a short-lived cookie for verification
  const cookieStore = await cookies();
  cookieStore.set("siphon_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 300, // 5 minutes
    path: "/",
  });

  return NextResponse.json({ nonce });
}
