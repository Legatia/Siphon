import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function requireSessionAddress(): Promise<
  { address: string } | { error: NextResponse }
> {
  const address = await getSession();
  if (!address) {
    return {
      error: NextResponse.json(
        { error: "Authentication required. Connect wallet and sign in." },
        { status: 401 }
      ),
    };
  }
  return { address: address.toLowerCase() };
}

export function ensureAddressMatch(
  sessionAddress: string,
  claimedAddress: string,
  fieldName = "address"
): NextResponse | null {
  if (!claimedAddress || sessionAddress !== claimedAddress.toLowerCase()) {
    return NextResponse.json(
      { error: `${fieldName} must match authenticated session` },
      { status: 403 }
    );
  }
  return null;
}
