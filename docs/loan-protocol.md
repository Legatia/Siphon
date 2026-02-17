# Siphon Loan Protocol — Agent-as-Collateral Lending

## Overview

The Siphon Loan Protocol enables owners to borrow ETH against their AI agents (Shards) as collateral. Shards have real, measurable value — they accumulate experience, reputation, and skills over time. This protocol turns that value into liquidity without forcing owners to sell.

The protocol consists of three contracts that layer on top of the existing Siphon infrastructure:

| Contract | Purpose |
|----------|---------|
| **ShardRegistry** (extended) | Lock primitive — prevents transfer while pledged |
| **ShardValuation** | Keeper-attested composite valuation oracle |
| **LoanVault** | Lending lifecycle — create, fund, repay, liquidate |

---

## How It Works

### The Lifecycle of a Loan

```
Owner           LoanVault            Lender
  |                 |                   |
  |-- createLoan -->|                   |
  |   (shard locked)|                   |
  |                 |<-- fundLoan ------|
  |   (ETH received)|                   |
  |                 |                   |
  |-- repayLoan --->|                   |
  |   (shard freed) |-- ETH + interest->|
  |                 |                   |
```

**Default path:**

```
  |                 |                   |
  |  (time expires) |                   |
  |                 |<-- liquidate -----|
  |  (shard seized) |   (shard transferred to lender)
```

### Step by Step

1. **Valuation** — A keeper attests to the shard's off-chain stats (level, ELO, stats sum). The ShardValuation contract combines these with on-chain reputation to produce a value in ETH.

2. **Approval** — The shard owner calls `registry.approveLock(vaultAddress)` to authorize the LoanVault to lock their shards.

3. **List** — The owner calls `vault.createLoan(loanId, shardId, principal, interestBps, duration)`. The shard is immediately locked — it cannot be transferred, released to wild, or used as collateral for another loan.

4. **Fund** — Any lender can call `vault.fundLoan(loanId)` with the exact principal amount. The ETH is forwarded to the borrower immediately.

5. **Repay** — Before the loan expires, the borrower calls `vault.repayLoan(loanId)` with principal + interest. The shard is unlocked and returned. The lender receives their payout minus a small protocol fee.

6. **Default** — If the borrower doesn't repay within the duration + a 1-day grace period, the lender can call `vault.liquidate(loanId)`. The shard's ownership is transferred to the lender via the `seize()` function.

7. **Cancel** — If no lender has funded the loan yet, the borrower can call `vault.cancelLoan(loanId)` to unlock their shard and remove the listing.

---

## Contracts

### ShardRegistry — Lock Primitive

The existing ShardRegistry was extended with a lock mechanism that allows approved contracts to freeze shard ownership.

**New state:**
- `lockedBy[shardId]` — which contract has locked a shard (`address(0)` = unlocked)
- `approvedLockers[owner][locker]` — owner-granted permissions

**New functions:**

| Function | Caller | Description |
|----------|--------|-------------|
| `approveLock(locker)` | Shard owner | Authorize a contract to lock your shards |
| `revokeLock(locker)` | Shard owner | Remove locker authorization |
| `lockShard(shardId)` | Approved locker | Freeze shard — blocks transfer and setWild |
| `unlockShard(shardId)` | The locker that locked it | Unfreeze shard |
| `seize(shardId, to)` | The locker that locked it | Force-transfer + unlock (for liquidation) |
| `isLocked(shardId)` | Anyone | Check lock status |

**Invariants:**
- A locked shard cannot be transferred or released to wild
- Only the contract that locked a shard can unlock or seize it
- `seize()` atomically unlocks and transfers ownership

### ShardValuation — Valuation Oracle

Computes a shard's value in ETH by combining keeper-attested off-chain stats with on-chain reputation.

**Valuation formula:**

```
value = BASE_VALUE
      + (level - 1) * LEVEL_BONUS
      + max(0, elo - 1200) * ELO_BONUS_PER_POINT
      + max(0, reputation) * REP_BONUS_PER_POINT
```

**Constants:**

| Parameter | Value | Description |
|-----------|-------|-------------|
| `BASE_VALUE` | 0.01 ETH | Minimum shard value |
| `LEVEL_BONUS` | 0.002 ETH/level | Per-level value increase |
| `ELO_BONUS_PER_POINT` | 0.00001 ETH/point | Per-ELO-point above 1200 |
| `REP_BONUS_PER_POINT` | 0.001 ETH/point | Per-reputation-point (from SiphonIdentity) |
| `ATTESTATION_TTL` | 7 days | Attestations expire and must be refreshed |

**Example valuations:**

| Shard Profile | Level | ELO | Reputation | Value |
|---------------|-------|-----|------------|-------|
| Fresh spawn | 1 | 1200 | 0 | 0.01 ETH |
| Mid-tier | 25 | 1500 | 5 | 0.066 ETH |
| Veteran | 50 | 2000 | 20 | 0.136 ETH |
| Elite | 100 | 2500 | 50 | 0.271 ETH |

**Keeper attestation:** Only governance-approved keepers can submit attestations. This prevents manipulation — keepers have staked ETH (via KeeperStaking) that can be slashed for dishonest appraisals.

### LoanVault — Lending Protocol

The core lending contract handling the full loan lifecycle.

**Loan parameters:**

| Parameter | Constraint | Description |
|-----------|------------|-------------|
| `principal` | > 0, <= 70% of shard value | Amount to borrow |
| `interestBps` | <= 5000 (50%) | Interest rate in basis points |
| `duration` | 1 hour — 365 days | Loan term |

**Protocol constants:**

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_LTV_BPS` | 7000 (70%) | Maximum loan-to-value ratio |
| `MAX_INTEREST_BPS` | 5000 (50%) | Maximum interest rate |
| `GRACE_PERIOD` | 1 day | Buffer after expiry before liquidation |
| `PROTOCOL_FEE_BPS` | 500 (5%) | Fee on interest (not principal) |

**Loan states:**

```
None → Listed → Funded → Repaid
                  ↓
               Liquidated

Listed → Cancelled
```

**Functions:**

| Function | Caller | Description |
|----------|--------|-------------|
| `createLoan(...)` | Borrower | Pledge shard, set terms |
| `fundLoan(loanId)` | Lender | Send ETH to fund the loan |
| `repayLoan(loanId)` | Borrower | Pay back principal + interest |
| `liquidate(loanId)` | Lender | Seize shard after default |
| `cancelLoan(loanId)` | Borrower | Cancel unfunded listing |
| `getRepaymentAmount(loanId)` | Anyone | Calculate total due |
| `isExpired(loanId)` | Anyone | Check if past duration |
| `isLiquidatable(loanId)` | Anyone | Check if past grace period |
| `withdrawFees()` | Governance | Withdraw protocol fees |

---

## Security Model

### Why It's Safe for Borrowers

- **Lock prevents theft** — a locked shard cannot be transferred by anyone, including the owner. The only way to move it is through `repayLoan` (unlock) or `liquidate` (seize).
- **LTV cap at 70%** — borrowers always have incentive to repay because the shard is worth more than the loan.
- **Grace period** — 1 day after expiry before liquidation. Protects against brief delays.
- **Cancel anytime** — unfunded loans can be cancelled, immediately unlocking the shard.

### Why It's Safe for Lenders

- **Collateral is locked** — the borrower can't run off with both the ETH and the shard.
- **Seize on default** — if the borrower doesn't repay, the lender gets the shard (which was worth more than the loan amount).
- **Fresh valuations required** — attestations expire after 7 days, preventing stale appraisals.
- **Keeper accountability** — attesters are staked keepers who can be slashed for dishonest valuations.

### Decay as Natural Liquidation Trigger

Shards decay over time if not actively trained. A neglected shard loses XP, ELO, and level — which drops its valuation. This creates a natural liquidation dynamic:

- A borrower who neglects their shard will see its value drop below the loan amount
- Other market participants can observe this and warn the borrower
- The lender can monitor shard health and plan accordingly

This is unique to agent-collateralized lending — the collateral is alive and requires maintenance.

---

## Integration with Existing Protocol

The loan protocol builds directly on top of the existing Siphon contracts:

```
┌─────────────────────────────────────────────────┐
│                   LoanVault                      │
│         create / fund / repay / liquidate        │
└──────────┬────────────────────┬──────────────────┘
           │                    │
           ▼                    ▼
┌──────────────────┐  ┌──────────────────┐
│  ShardValuation   │  │  ShardRegistry    │
│  (keeper-attested │  │  (lock/unlock/    │
│   composite value)│  │   seize)          │
└────────┬─────────┘  └──────────────────┘
         │
    ┌────┴────────────────┐
    ▼                     ▼
┌──────────────┐  ┌──────────────────┐
│ SiphonIdentity│  │  KeeperStaking   │
│ (on-chain     │  │  (attester       │
│  reputation)  │  │   accountability)│
└──────────────┘  └──────────────────┘
```

---

## Future Extensions

- **ERC-20 loans** — support USDC or other stablecoin lending alongside ETH
- **Auction liquidation** — instead of direct seize, auction the shard to get best price (surplus goes back to borrower)
- **Refinancing** — allow borrowers to refinance with a new lender before expiry
- **Lending pools** — multiple lenders pool ETH, protocol auto-matches to borrowers
- **Decay-triggered liquidation** — automatically flag loans where shard valuation has dropped below a health factor threshold
- **Credit scoring** — borrowers build on-chain credit history from successful repayments, unlocking better LTV ratios
