import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbRun } from "@/lib/db";
import crypto from "crypto";

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

    // Basic email validation
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await dbGet<{ id: string }>(
      "SELECT id FROM waitlist_subscribers WHERE email = ?",
      normalized
    );

    if (existing) {
      return NextResponse.json({ ok: true, message: "Already subscribed" });
    }

    await dbRun(
      "INSERT INTO waitlist_subscribers (id, email, source, created_at) VALUES (?, ?, ?, ?)",
      crypto.randomUUID(),
      normalized,
      source || "hero",
      Date.now()
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Waitlist error:", error);
    return NextResponse.json(
      { error: "Failed to subscribe" },
      { status: 500 }
    );
  }
}
