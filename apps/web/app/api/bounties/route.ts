import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbGet, dbRun } from "@/lib/db";
import crypto from "crypto";
import { ensureAddressMatch, requireSessionAddress } from "@/lib/session-auth";
import { getShardById } from "@/lib/shard-engine";
import { generateShardResponse } from "@/lib/llm";
import { logActivationEvent } from "@/lib/activation-analytics";

export const dynamic = "force-dynamic";

/**
 * GET /api/bounties — List bounties with optional state filter
 * POST /api/bounties — Record a new bounty (after on-chain postBounty)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state");

  try {
    let bounties;
    if (state) {
      bounties = await dbAll(
        "SELECT * FROM bounties WHERE state = ? ORDER BY created_at DESC",
        state
      );
    } else {
      bounties = await dbAll(
        "SELECT * FROM bounties ORDER BY created_at DESC"
      );
    }

    return NextResponse.json(bounties);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch bounties" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { poster, reward, description, deadline, txHash, bountyIdHex } = body;

    if (!poster || !reward || !description || !deadline || !txHash || !bountyIdHex) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const mismatch = ensureAddressMatch(auth.address, poster, "poster");
    if (mismatch) return mismatch;

    const id = crypto.randomUUID();
    const now = Date.now();

    await dbRun(
      `INSERT INTO bounties (id, bounty_id_hex, poster, reward, description, deadline, state, tx_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'Open', ?, ?)`,
      id, bountyIdHex, poster, reward, description, deadline, txHash, now
    );

    return NextResponse.json({ id, bountyIdHex, poster, reward, description, deadline, state: "Open" }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create bounty";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/bounties — Update bounty state (claim/complete/dispute/cancel)
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSessionAddress();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { bountyId, action, shardOrSwarmId } = body;

    if (!bountyId || !action) {
      return NextResponse.json(
        { error: "Missing bountyId or action" },
        { status: 400 }
      );
    }

    const bounty = await dbGet<BountyRow>(
      "SELECT * FROM bounties WHERE id = ?",
      bountyId
    );

    if (!bounty) {
      return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
    }

    switch (action) {
      case "claim": {
        if (bounty.state !== "Open") {
          return NextResponse.json({ error: "Bounty is not open" }, { status: 400 });
        }
        await dbRun(
          "UPDATE bounties SET state = 'Claimed', claimant = ?, shard_or_swarm_id = ? WHERE id = ?",
          auth.address, shardOrSwarmId ?? null, bountyId
        );
        await logActivationEvent({
          ownerId: auth.address,
          eventType: "claimed_bounty",
          source: "api:bounties/claim",
          entityId: bountyId,
          uniqueKey: `${auth.address}:claimed_bounty:${bountyId}`,
          metadata: { shardOrSwarmId: shardOrSwarmId ?? null, reward: bounty.reward },
        });

        // Trigger actual shard execution against bounty description.
        if (shardOrSwarmId) {
          await dbRun("UPDATE bounties SET execution_status = 'running' WHERE id = ?", bountyId);
          try {
            const shard = await getShardById(shardOrSwarmId);
            if (!shard) {
              await dbRun(
                "UPDATE bounties SET execution_status = 'failed', execution_result = ? WHERE id = ?",
                "Shard not found for execution", bountyId
              );
            } else {
              const result = await generateShardResponse(
                shard,
                [],
                `Complete this bounty task:\n\n${bounty.description}`
              );
              await dbRun(
                "UPDATE bounties SET execution_status = 'completed', execution_result = ? WHERE id = ?",
                result, bountyId
              );
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : "Execution failed";
            await dbRun(
              "UPDATE bounties SET execution_status = 'failed', execution_result = ? WHERE id = ?",
              message, bountyId
            );
          }
        }
        break;
      }
      case "complete": {
        if (bounty.state !== "Claimed") {
          return NextResponse.json({ error: "Bounty is not claimed" }, { status: 400 });
        }
        if (auth.address !== bounty.poster.toLowerCase()) {
          return NextResponse.json({ error: "Only the poster can complete a bounty" }, { status: 403 });
        }
        await dbRun("UPDATE bounties SET state = 'Completed' WHERE id = ?", bountyId);
        if (bounty.claimant) {
          await logActivationEvent({
            ownerId: bounty.claimant,
            eventType: "completed_bounty",
            source: "api:bounties/complete",
            entityId: bountyId,
            uniqueKey: `${bounty.claimant.toLowerCase()}:completed_bounty:${bountyId}`,
            metadata: { reward: bounty.reward, poster: bounty.poster },
          });
        }
        break;
      }
      case "dispute": {
        if (bounty.state !== "Claimed") {
          return NextResponse.json({ error: "Bounty is not claimed" }, { status: 400 });
        }
        if (auth.address !== bounty.poster.toLowerCase() && auth.address !== bounty.claimant?.toLowerCase()) {
          return NextResponse.json({ error: "Only the poster or claimant can dispute" }, { status: 403 });
        }
        await dbRun("UPDATE bounties SET state = 'Disputed' WHERE id = ?", bountyId);
        break;
      }
      case "cancel": {
        if (bounty.state !== "Open") {
          return NextResponse.json({ error: "Can only cancel open bounties" }, { status: 400 });
        }
        if (auth.address !== bounty.poster.toLowerCase()) {
          return NextResponse.json({ error: "Only the poster can cancel" }, { status: 403 });
        }
        await dbRun("UPDATE bounties SET state = 'Cancelled' WHERE id = ?", bountyId);
        break;
      }
      case "resolve_complete": {
        if (bounty.state !== "Disputed") {
          return NextResponse.json({ error: "Bounty is not disputed" }, { status: 400 });
        }
        const arbiter = process.env.ARBITER_ADDRESS?.toLowerCase();
        if (auth.address !== bounty.poster.toLowerCase() && auth.address !== arbiter) {
          return NextResponse.json({ error: "Only poster or arbiter can resolve dispute" }, { status: 403 });
        }
        await dbRun("UPDATE bounties SET state = 'Completed' WHERE id = ?", bountyId);
        if (bounty.claimant) {
          await logActivationEvent({
            ownerId: bounty.claimant,
            eventType: "completed_bounty",
            source: "api:bounties/resolve_complete",
            entityId: bountyId,
            uniqueKey: `${bounty.claimant.toLowerCase()}:completed_bounty:${bountyId}`,
            metadata: { reward: bounty.reward, poster: bounty.poster, disputed: true },
          });
        }
        break;
      }
      case "resolve_cancel": {
        if (bounty.state !== "Disputed") {
          return NextResponse.json({ error: "Bounty is not disputed" }, { status: 400 });
        }
        const arbiter = process.env.ARBITER_ADDRESS?.toLowerCase();
        if (auth.address !== bounty.poster.toLowerCase() && auth.address !== arbiter) {
          return NextResponse.json({ error: "Only poster or arbiter can resolve dispute" }, { status: 403 });
        }
        await dbRun("UPDATE bounties SET state = 'Cancelled' WHERE id = ?", bountyId);
        break;
      }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const updated = await dbGet("SELECT * FROM bounties WHERE id = ?", bountyId);
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update bounty";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface BountyRow {
  id: string;
  bounty_id_hex: string;
  poster: string;
  claimant?: string;
  shard_or_swarm_id?: string;
  reward: string;
  description: string;
  deadline: number;
  state: string;
  execution_status?: string;
  execution_result?: string;
  tx_hash?: string;
  created_at: number;
}
