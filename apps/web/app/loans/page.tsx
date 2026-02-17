"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Landmark,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Shield,
} from "lucide-react";
import type { LoanListing, Loan, Shard } from "@siphon/core";
import { LoanState } from "@siphon/core";
import {
  publicClient,
  getWalletClient,
  idToBytes32,
  LOAN_VAULT_ABI,
  LOAN_VAULT_ADDRESS,
  SHARD_REGISTRY_LOCK_ABI,
  SHARD_REGISTRY_ADDRESS,
  SHARD_VALUATION_ABI,
  SHARD_VALUATION_ADDRESS,
} from "@/lib/contracts";

function formatEth(wei: string): string {
  const n = Number(BigInt(wei)) / 1e18;
  return n.toFixed(4);
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

function stateLabel(state: LoanState): string {
  switch (state) {
    case LoanState.Listed:
      return "Listed";
    case LoanState.Funded:
      return "Active";
    case LoanState.Repaid:
      return "Repaid";
    case LoanState.Liquidated:
      return "Liquidated";
    case LoanState.Cancelled:
      return "Cancelled";
    default:
      return "Unknown";
  }
}

function stateColor(state: LoanState): string {
  switch (state) {
    case LoanState.Listed:
      return "text-siphon-teal";
    case LoanState.Funded:
      return "text-amber-400";
    case LoanState.Repaid:
      return "text-green-400";
    case LoanState.Liquidated:
      return "text-red-400";
    case LoanState.Cancelled:
      return "text-ghost";
    default:
      return "text-ghost";
  }
}

function LoanCard({
  listing,
  address,
  onAction,
}: {
  listing: LoanListing;
  address?: string;
  onAction: () => void;
}) {
  const { loan, shard, repaymentAmount, isExpired, isLiquidatable } = listing;
  const isBorrower = address?.toLowerCase() === loan.borrower.toLowerCase();
  const isLender =
    loan.lender && address?.toLowerCase() === loan.lender.toLowerCase();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(action: string) {
    setLoading(action);
    setError(null);

    try {
      const walletClient = getWalletClient();
      if (!walletClient || !address) {
        setError("Connect your wallet first");
        return;
      }

      const loanIdBytes = idToBytes32(loan.id);
      let txHash: string | undefined;

      if (action === "fund") {
        const hash = await walletClient.writeContract({
          account: address as `0x${string}`,
          address: LOAN_VAULT_ADDRESS as `0x${string}`,
          abi: LOAN_VAULT_ABI,
          functionName: "fundLoan",
          args: [loanIdBytes],
          value: BigInt(loan.principal),
        });
        await publicClient.waitForTransactionReceipt({ hash });
        txHash = hash;

        await fetch(`/api/loans/${loan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "fund", lender: address, txHash }),
        });
      } else if (action === "repay") {
        const repayAmount = await publicClient.readContract({
          address: LOAN_VAULT_ADDRESS as `0x${string}`,
          abi: LOAN_VAULT_ABI,
          functionName: "getRepaymentAmount",
          args: [loanIdBytes],
        });

        const hash = await walletClient.writeContract({
          account: address as `0x${string}`,
          address: LOAN_VAULT_ADDRESS as `0x${string}`,
          abi: LOAN_VAULT_ABI,
          functionName: "repayLoan",
          args: [loanIdBytes],
          value: repayAmount as bigint,
        });
        await publicClient.waitForTransactionReceipt({ hash });
        txHash = hash;

        await fetch(`/api/loans/${loan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "repay", txHash }),
        });
      } else if (action === "liquidate") {
        const hash = await walletClient.writeContract({
          account: address as `0x${string}`,
          address: LOAN_VAULT_ADDRESS as `0x${string}`,
          abi: LOAN_VAULT_ABI,
          functionName: "liquidate",
          args: [loanIdBytes],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        txHash = hash;

        await fetch(`/api/loans/${loan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "liquidate", txHash }),
        });
      } else if (action === "cancel") {
        const hash = await walletClient.writeContract({
          account: address as `0x${string}`,
          address: LOAN_VAULT_ADDRESS as `0x${string}`,
          abi: LOAN_VAULT_ABI,
          functionName: "cancelLoan",
          args: [loanIdBytes],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        txHash = hash;

        await fetch(`/api/loans/${loan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel", caller: address, txHash }),
        });
      }

      onAction();
    } catch (err: any) {
      console.error(`Loan action ${action} failed:`, err);
      setError(err?.shortMessage || err?.message || "Transaction failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className="p-5 bg-midnight/60 border-siphon-teal/10 hover:border-siphon-teal/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4 text-deep-violet" />
            <span className="font-semibold text-foam">{shard.name}</span>
            <span className="text-xs text-ghost capitalize">
              {shard.species}
            </span>
          </div>
          <div className="text-xs text-ghost">
            Lv.{shard.level} · ELO {shard.eloRating}
          </div>
        </div>
        <span className={`text-xs font-medium ${stateColor(loan.state)}`}>
          {stateLabel(loan.state)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
        <div>
          <div className="text-ghost text-xs">Principal</div>
          <div className="text-foam font-mono">{formatEth(loan.principal)} ETH</div>
        </div>
        <div>
          <div className="text-ghost text-xs">Interest</div>
          <div className="text-foam font-mono">
            {(loan.interestBps / 100).toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-ghost text-xs">Duration</div>
          <div className="text-foam font-mono">
            {formatDuration(loan.duration)}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-ghost mb-3">
        <span>Repay: {formatEth(repaymentAmount)} ETH</span>
        <span>
          Collateral: {formatEth(loan.collateralValue)} ETH
        </span>
      </div>

      {isExpired && loan.state === LoanState.Funded && (
        <div className="flex items-center gap-1 text-xs text-amber-400 mb-3">
          <AlertTriangle className="h-3 w-3" />
          {isLiquidatable ? "Loan defaulted — liquidatable" : "Loan expired — in grace period"}
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400 mb-3">{error}</div>
      )}

      <div className="flex gap-2">
        {loan.state === LoanState.Listed && !isBorrower && (
          <Button
            size="sm"
            className="bg-siphon-teal text-midnight hover:bg-siphon-teal/80"
            onClick={() => handleAction("fund")}
            disabled={!!loading}
          >
            <ArrowUpRight className="h-3 w-3 mr-1" />
            {loading === "fund" ? "Confirming..." : "Fund Loan"}
          </Button>
        )}
        {loan.state === LoanState.Listed && isBorrower && (
          <Button
            size="sm"
            variant="outline"
            className="border-ghost/30 text-ghost hover:text-foam"
            onClick={() => handleAction("cancel")}
            disabled={!!loading}
          >
            <XCircle className="h-3 w-3 mr-1" />
            {loading === "cancel" ? "Confirming..." : "Cancel"}
          </Button>
        )}
        {loan.state === LoanState.Funded && isBorrower && (
          <Button
            size="sm"
            className="bg-green-600 text-white hover:bg-green-500"
            onClick={() => handleAction("repay")}
            disabled={!!loading}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {loading === "repay" ? "Confirming..." : `Repay ${formatEth(repaymentAmount)} ETH`}
          </Button>
        )}
        {loan.state === LoanState.Funded && isLender && isLiquidatable && (
          <Button
            size="sm"
            className="bg-red-600 text-white hover:bg-red-500"
            onClick={() => handleAction("liquidate")}
            disabled={!!loading}
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            {loading === "liquidate" ? "Confirming..." : "Liquidate"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function CreateLoanForm({
  shards,
  address,
  onCreated,
}: {
  shards: Shard[];
  address: string;
  onCreated: () => void;
}) {
  const [shardId, setShardId] = useState("");
  const [principal, setPrincipal] = useState("0.05");
  const [interestBps, setInterestBps] = useState("500");
  const [durationDays, setDurationDays] = useState("30");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const walletClient = getWalletClient();
      if (!walletClient) {
        setError("Connect your wallet first");
        return;
      }

      const principalWei = BigInt(Math.round(parseFloat(principal) * 1e18));
      const durationSec = parseInt(durationDays) * 86400;
      const shardIdBytes = idToBytes32(shardId);

      // 1. Read on-chain valuation for real collateral value
      let collateralValue: bigint;
      try {
        collateralValue = (await publicClient.readContract({
          address: SHARD_VALUATION_ADDRESS as `0x${string}`,
          abi: SHARD_VALUATION_ABI,
          functionName: "valueShard",
          args: [shardIdBytes],
        })) as bigint;
      } catch {
        // Fallback to principal if valuation contract not deployed
        collateralValue = principalWei;
      }

      // 2. Approve the LoanVault as a locker on ShardRegistry
      const approveHash = await walletClient.writeContract({
        account: address as `0x${string}`,
        address: SHARD_REGISTRY_ADDRESS as `0x${string}`,
        abi: SHARD_REGISTRY_LOCK_ABI,
        functionName: "approveLock",
        args: [LOAN_VAULT_ADDRESS as `0x${string}`],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // 3. Generate a loanId (bytes32 from random UUID)
      const loanId = crypto.randomUUID();
      const loanIdBytes = idToBytes32(loanId);

      // 4. Create loan on-chain
      const createHash = await walletClient.writeContract({
        account: address as `0x${string}`,
        address: LOAN_VAULT_ADDRESS as `0x${string}`,
        abi: LOAN_VAULT_ABI,
        functionName: "createLoan",
        args: [
          loanIdBytes,
          shardIdBytes,
          principalWei,
          BigInt(parseInt(interestBps)),
          BigInt(durationSec),
        ],
      });
      await publicClient.waitForTransactionReceipt({ hash: createHash });

      // 5. Record in SQLite
      await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: loanId,
          shardId,
          borrower: address,
          principal: principalWei.toString(),
          interestBps: parseInt(interestBps),
          duration: durationSec,
          collateralValue: collateralValue.toString(),
          txHash: createHash,
        }),
      });

      onCreated();
      setShardId("");
    } catch (err: any) {
      console.error("Failed to create loan:", err);
      setError(err?.shortMessage || err?.message || "Transaction failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card className="p-5 bg-midnight/60 border-siphon-teal/10">
      <h3 className="text-foam font-semibold mb-4 flex items-center gap-2">
        <ArrowDownLeft className="h-4 w-4 text-siphon-teal" />
        Borrow Against Your Shard
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-ghost block mb-1">Collateral Shard</label>
          <select
            value={shardId}
            onChange={(e) => setShardId(e.target.value)}
            className="w-full bg-midnight border border-ghost/20 rounded-lg px-3 py-2 text-sm text-foam focus:border-siphon-teal outline-none"
            required
          >
            <option value="">Select a shard...</option>
            {shards.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — Lv.{s.level} ({s.species})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-ghost block mb-1">
              Principal (ETH)
            </label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              className="w-full bg-midnight border border-ghost/20 rounded-lg px-3 py-2 text-sm text-foam focus:border-siphon-teal outline-none"
              required
            />
          </div>
          <div>
            <label className="text-xs text-ghost block mb-1">
              Interest (bps)
            </label>
            <input
              type="number"
              min="0"
              max="5000"
              value={interestBps}
              onChange={(e) => setInterestBps(e.target.value)}
              className="w-full bg-midnight border border-ghost/20 rounded-lg px-3 py-2 text-sm text-foam focus:border-siphon-teal outline-none"
              required
            />
          </div>
          <div>
            <label className="text-xs text-ghost block mb-1">
              Duration (days)
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className="w-full bg-midnight border border-ghost/20 rounded-lg px-3 py-2 text-sm text-foam focus:border-siphon-teal outline-none"
              required
            />
          </div>
        </div>

        <div className="text-xs text-ghost">
          {interestBps && principal
            ? `Repayment: ${(
                parseFloat(principal) *
                (1 + parseInt(interestBps) / 10000)
              ).toFixed(4)} ETH (${(parseInt(interestBps) / 100).toFixed(1)}% interest)`
            : ""}
        </div>

        {error && (
          <div className="text-xs text-red-400">{error}</div>
        )}

        <Button
          type="submit"
          disabled={creating || !shardId}
          className="w-full bg-siphon-teal text-midnight hover:bg-siphon-teal/80"
        >
          {creating ? "Creating (confirm in wallet)..." : "Create Loan Listing"}
        </Button>
      </form>
    </Card>
  );
}

export default function LoansPage() {
  const { address } = useAccount();
  const [listings, setListings] = useState<LoanListing[]>([]);
  const [myLoans, setMyLoans] = useState<Loan[]>([]);
  const [activeLoans, setActiveLoans] = useState<LoanListing[]>([]);
  const [myShards, setMyShards] = useState<Shard[]>([]);
  const [tab, setTab] = useState("browse");

  function refresh() {
    fetch("/api/loans?view=listings")
      .then((r) => r.json())
      .then(setListings)
      .catch(() => {});

    fetch("/api/loans?view=active")
      .then((r) => r.json())
      .then(setActiveLoans)
      .catch(() => {});

    if (address) {
      fetch(`/api/loans?borrower=${address}`)
        .then((r) => r.json())
        .then(setMyLoans)
        .catch(() => {});

      fetch(`/api/shards?ownerId=${address}`)
        .then((r) => r.json())
        .then(setMyShards)
        .catch(() => {});
    }
  }

  useEffect(() => {
    refresh();
  }, [address]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Landmark className="h-7 w-7 text-siphon-teal" />
        <h1 className="text-2xl font-bold text-foam">Shard Loans</h1>
        <span className="text-sm text-ghost">
          Borrow ETH against your AI agents
        </span>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-midnight/80 border border-siphon-teal/10 mb-6">
          <TabsTrigger value="browse" className="data-[state=active]:bg-siphon-teal/10 data-[state=active]:text-siphon-teal">
            <ArrowUpRight className="h-3.5 w-3.5 mr-1.5" />
            Lend ({listings.length})
          </TabsTrigger>
          <TabsTrigger value="borrow" className="data-[state=active]:bg-siphon-teal/10 data-[state=active]:text-siphon-teal">
            <ArrowDownLeft className="h-3.5 w-3.5 mr-1.5" />
            Borrow
          </TabsTrigger>
          <TabsTrigger value="active" className="data-[state=active]:bg-siphon-teal/10 data-[state=active]:text-siphon-teal">
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            Active ({activeLoans.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-siphon-teal/10 data-[state=active]:text-siphon-teal">
            My Loans ({myLoans.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse">
          {listings.length === 0 ? (
            <Card className="p-8 bg-midnight/60 border-siphon-teal/10 text-center">
              <Landmark className="h-8 w-8 text-ghost mx-auto mb-3" />
              <p className="text-ghost">No loan listings yet.</p>
              <p className="text-ghost text-sm mt-1">
                Be the first to create one in the Borrow tab.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {listings.map((listing) => (
                <LoanCard
                  key={listing.loan.id}
                  listing={listing}
                  address={address}
                  onAction={refresh}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="borrow">
          {!address ? (
            <Card className="p-8 bg-midnight/60 border-siphon-teal/10 text-center">
              <p className="text-ghost">
                Connect your wallet to create a loan.
              </p>
            </Card>
          ) : myShards.length === 0 ? (
            <Card className="p-8 bg-midnight/60 border-siphon-teal/10 text-center">
              <p className="text-ghost">
                You don't own any shards to use as collateral.
              </p>
            </Card>
          ) : (
            <CreateLoanForm
              shards={myShards}
              address={address}
              onCreated={refresh}
            />
          )}
        </TabsContent>

        <TabsContent value="active">
          {activeLoans.length === 0 ? (
            <Card className="p-8 bg-midnight/60 border-siphon-teal/10 text-center">
              <p className="text-ghost">No active loans.</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activeLoans.map((listing) => (
                <LoanCard
                  key={listing.loan.id}
                  listing={listing}
                  address={address}
                  onAction={refresh}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {myLoans.length === 0 ? (
            <Card className="p-8 bg-midnight/60 border-siphon-teal/10 text-center">
              <p className="text-ghost">No loan history.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {myLoans.map((loan) => (
                <Card
                  key={loan.id}
                  className="p-4 bg-midnight/60 border-siphon-teal/10 flex items-center justify-between"
                >
                  <div>
                    <span className="text-foam font-mono text-sm">
                      {formatEth(loan.principal)} ETH
                    </span>
                    <span className="text-ghost text-xs ml-2">
                      {(loan.interestBps / 100).toFixed(1)}% ·{" "}
                      {formatDuration(loan.duration)}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-medium ${stateColor(loan.state)}`}
                  >
                    {stateLabel(loan.state)}
                  </span>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
