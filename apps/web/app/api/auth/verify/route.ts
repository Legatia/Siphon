import { NextRequest, NextResponse } from "next/server";
import { buildSiweMessage, verifySiweSignature, setSession } from "@/lib/auth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/verify — Verify SIWE signature and create session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, signature } = body;

    if (!address || !signature) {
      return NextResponse.json(
        { error: "Missing address or signature" },
        { status: 400 }
      );
    }

    // Retrieve nonce from cookie
    const cookieStore = await cookies();
    const nonce = cookieStore.get("siphon_nonce")?.value;

    if (!nonce) {
      return NextResponse.json(
        { error: "Nonce expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Rebuild the message that should have been signed
    const message = buildSiweMessage(address, nonce);

    // Verify signature
    const valid = await verifySiweSignature(address, message, signature as `0x${string}`);

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Create session
    await setSession(address);

    // Clear nonce cookie
    cookieStore.delete("siphon_nonce");

    return NextResponse.json({ ok: true, address: address.toLowerCase() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
