import { verifyMessage } from "viem";
import { cookies } from "next/headers";
import crypto from "crypto";

const SESSION_COOKIE = "siphon_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-in-production";

/**
 * Lightweight SIWE-style session management.
 *
 * Flow:
 * 1. Client calls GET /api/auth/nonce to get a nonce
 * 2. Client signs a message containing the nonce with their wallet
 * 3. Client calls POST /api/auth/verify with { address, message, signature }
 * 4. Server verifies the signature, sets an HMAC-signed session cookie
 * 5. Subsequent API calls read the session from the cookie
 */

/** Generate a cryptographically random nonce */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

/** Build the SIWE-style message for the user to sign */
export function buildSiweMessage(address: string, nonce: string): string {
  return `Sign in to Siphon Protocol\n\nAddress: ${address}\nNonce: ${nonce}`;
}

/** Verify a signed message and return the recovered address */
export async function verifySiweSignature(
  address: string,
  message: string,
  signature: `0x${string}`
): Promise<boolean> {
  try {
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature,
    });
    return valid;
  } catch {
    return false;
  }
}

/** Create an HMAC-signed session token: address.hmac */
function createSessionToken(address: string): string {
  const hmac = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(address.toLowerCase())
    .digest("hex");
  return `${address.toLowerCase()}.${hmac}`;
}

/** Verify and decode a session token. Returns the address or null. */
function verifySessionToken(token: string): string | null {
  const [address, hmac] = token.split(".");
  if (!address || !hmac) return null;

  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(address)
    .digest("hex");

  if (hmac !== expected) return null;
  return address;
}

/** Set the session cookie after successful verification */
export async function setSession(address: string): Promise<void> {
  const token = createSessionToken(address);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

/** Read the current session. Returns the wallet address or null. */
export async function getSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Clear the session cookie */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
