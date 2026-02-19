import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { cookies } from "next/headers";
import crypto from "crypto";

/**
 * Server-side public client for ERC-1271 signature verification.
 * Smart Wallet signatures need an on-chain `isValidSignature` call.
 */
const authPublicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const SESSION_COOKIE = "siphon_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-in-production";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000; // Refresh if >1 day old

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

/**
 * Verify a signed message. Supports both EOA (ecrecover) and
 * Smart Wallet (ERC-1271 on-chain isValidSignature).
 */
export async function verifySiweSignature(
  address: string,
  message: string,
  signature: `0x${string}`
): Promise<boolean> {
  try {
    // publicClient.verifyMessage tries ecrecover first, then falls back
    // to calling isValidSignature(bytes32,bytes) on the address contract.
    // This handles both EOA and Smart Wallet (ERC-4337 / ERC-1271).
    const valid = await authPublicClient.verifyMessage({
      address: address as `0x${string}`,
      message,
      signature,
    });
    return valid;
  } catch {
    return false;
  }
}

/** Create an HMAC-signed session token: address.timestamp.hmac */
function createSessionToken(address: string): string {
  const ts = Date.now().toString(36);
  const payload = `${address.toLowerCase()}.${ts}`;
  const hmac = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("hex");
  return `${payload}.${hmac}`;
}

/** Verify and decode a session token. Returns { address, issuedAt } or null. */
function verifySessionToken(token: string): { address: string; issuedAt: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [address, ts, hmac] = parts;
  if (!address || !ts || !hmac) return null;

  const payload = `${address}.${ts}`;
  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("hex");

  if (hmac !== expected) return null;

  const issuedAt = parseInt(ts, 36);
  if (isNaN(issuedAt)) return null;

  // Check expiry
  if (Date.now() - issuedAt > SESSION_MAX_AGE_MS) return null;

  return { address, issuedAt };
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

/** Read the current session. Returns the wallet address or null. Rotates cookie if stale. */
export async function getSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const result = verifySessionToken(token);
  if (!result) return null;

  // Rotate session if older than threshold (silent refresh)
  if (Date.now() - result.issuedAt > SESSION_REFRESH_THRESHOLD_MS) {
    try {
      await setSession(result.address);
    } catch {
      // Cookie rotation is best-effort in read-only contexts
    }
  }

  return result.address;
}

/** Clear the session cookie */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
