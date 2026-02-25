import { NextRequest, NextResponse } from "next/server";

const SHEET_URL = process.env.GOOGLE_SHEET_WAITLIST_URL;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, source } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid email" },
        { status: 400 }
      );
    }

    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (!SHEET_URL) {
      console.error("GOOGLE_SHEET_WAITLIST_URL not configured");
      return NextResponse.json(
        { error: "Waitlist not configured" },
        { status: 503 }
      );
    }

    // Google Apps Script redirects (302) on POST — follow it.
    // Use text/plain to avoid CORS preflight issues on the Apps Script side.
    const res = await fetch(SHEET_URL, {
      method: "POST",
      body: JSON.stringify({ email: normalized, source: source || "hero" }),
      headers: { "Content-Type": "text/plain" },
      redirect: "follow",
    });

    if (!res.ok) {
      console.error("Sheet POST failed:", res.status, await res.text().catch(() => ""));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Waitlist error:", error);
    return NextResponse.json(
      { error: "Failed to subscribe" },
      { status: 500 }
    );
  }
}
