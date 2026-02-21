import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Global middleware for rate limiting API routes.
 * Runs on Edge runtime — rate-limit store is per-process.
 */

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isLandingOnlyDeployment(): boolean {
  return process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production";
}

function isAllowedLandingPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/images/")) return true;
  if (pathname === "/favicon.ico" || pathname === "/robots.txt" || pathname === "/sitemap.xml") {
    return true;
  }
  // Allow static files from /public (e.g. /logo.svg, /fonts/*.woff2)
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Vercel production deployment should only serve the marketing landing page.
  if (isLandingOnlyDeployment() && !isAllowedLandingPath(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Only rate-limit API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Skip rate limiting for cron endpoints (server-to-server)
  if (pathname.startsWith("/api/cron/")) {
    return NextResponse.next();
  }

  // Skip rate limiting for webhook endpoints
  if (pathname.includes("/webhook")) {
    return NextResponse.next();
  }

  const ip = getClientIp(request);
  const method = request.method;

  // Choose rate limit config based on route + method
  let config: { max: number; windowMs: number } = RATE_LIMITS.read;
  let prefix = "api:read";

  if (pathname.startsWith("/api/auth/")) {
    config = RATE_LIMITS.auth;
    prefix = "auth";
  } else if (method === "POST" || method === "PATCH" || method === "DELETE") {
    // On-chain ops get tighter limits
    if (
      pathname.includes("/capture") ||
      pathname.includes("/loans") ||
      pathname.includes("/settle") ||
      pathname.includes("/marketplace") ||
      pathname.includes("/bounties") ||
      pathname.includes("/attest") ||
      pathname.includes("/fusion") ||
      pathname.includes("/stake")
    ) {
      config = RATE_LIMITS.onchain;
      prefix = "api:onchain";
    } else {
      config = RATE_LIMITS.write;
      prefix = "api:write";
    }
  }

  const key = `${prefix}:${ip}`;
  const result = await checkRateLimit(key, config);
  if (!result.allowed) {
    return new NextResponse(
      JSON.stringify({
        error: "Too many requests. Please try again later.",
        retryAfterMs: result.resetMs,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(result.resetMs / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  return response;
}

export const config = {
  matcher: "/:path*",
};
