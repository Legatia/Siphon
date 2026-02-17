import { createPublicClient, createWalletClient, http, custom } from "viem";
import { baseSepolia } from "viem/chains";

export const SHARD_REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    inputs: [
      { name: "shardId", type: "bytes32" },
      { name: "genomeHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [
      { name: "shardId", type: "bytes32" },
      { name: "to", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setWild",
    inputs: [{ name: "shardId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getOwner",
    inputs: [{ name: "shardId", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getOrigin",
    inputs: [{ name: "shardId", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ShardRegistered",
    inputs: [
      { name: "shardId", type: "bytes32", indexed: true },
      { name: "genomeHash", type: "bytes32", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      { name: "shardId", type: "bytes32", indexed: true },
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
    ],
  },
] as const;

export const KEEPER_STAKING_ABI = [
  {
    type: "function",
    name: "stake",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "requestUnstake",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "unstake",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimRewards",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getKeeperInfo",
    inputs: [{ name: "keeper", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "stakedAmount", type: "uint256" },
          { name: "unstakeRequestedAt", type: "uint256" },
          { name: "rewards", type: "uint256" },
          { name: "isActive", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;

export const BATTLE_SETTLEMENT_ABI = [
  {
    type: "function",
    name: "createBattle",
    inputs: [
      { name: "battleId", type: "bytes32" },
      { name: "defender", type: "address" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "joinBattle",
    inputs: [{ name: "battleId", type: "bytes32" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "settle",
    inputs: [
      { name: "battleId", type: "bytes32" },
      { name: "winner", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "dispute",
    inputs: [{ name: "battleId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resolveDispute",
    inputs: [
      { name: "battleId", type: "bytes32" },
      { name: "winner", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getBattle",
    inputs: [{ name: "battleId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "battleId", type: "bytes32" },
          { name: "challenger", type: "address" },
          { name: "defender", type: "address" },
          { name: "stakeAmount", type: "uint256" },
          { name: "state", type: "uint8" },
          { name: "winner", type: "address" },
          { name: "createdAt", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "BattleCreated",
    inputs: [
      { name: "battleId", type: "bytes32", indexed: true },
      { name: "challenger", type: "address", indexed: true },
      { name: "defender", type: "address", indexed: true },
      { name: "stake", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BattleSettled",
    inputs: [
      { name: "battleId", type: "bytes32", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "payout", type: "uint256", indexed: false },
    ],
  },
] as const;

export const SIPHON_IDENTITY_ABI = [
  {
    type: "function",
    name: "mintAgent",
    inputs: [{ name: "genomeHash", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateReputation",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "delta", type: "int256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getReputation",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "int256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "addValidation",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "result", type: "bool" },
      { name: "evidence", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAgent",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "genomeHash", type: "bytes32" },
          { name: "owner", type: "address" },
          { name: "reputation", type: "int256" },
          { name: "validationCount", type: "uint256" },
          { name: "mintedAt", type: "uint256" },
          { name: "tokenURI", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTokenByGenome",
    inputs: [{ name: "genomeHash", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// --- Lock extensions on ShardRegistry ---
export const SHARD_REGISTRY_LOCK_ABI = [
  {
    type: "function",
    name: "approveLock",
    inputs: [{ name: "locker", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeLock",
    inputs: [{ name: "locker", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isLocked",
    inputs: [{ name: "shardId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lockedBy",
    inputs: [{ name: "shardId", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ShardLocked",
    inputs: [
      { name: "shardId", type: "bytes32", indexed: true },
      { name: "locker", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "ShardUnlocked",
    inputs: [
      { name: "shardId", type: "bytes32", indexed: true },
      { name: "locker", type: "address", indexed: true },
    ],
  },
] as const;

// --- ShardValuation ---
export const SHARD_VALUATION_ABI = [
  {
    type: "function",
    name: "attest",
    inputs: [
      { name: "shardId", type: "bytes32" },
      { name: "level", type: "uint256" },
      { name: "elo", type: "uint256" },
      { name: "statsSum", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "valueShard",
    inputs: [{ name: "shardId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasValidAttestation",
    inputs: [{ name: "shardId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAttestation",
    inputs: [{ name: "shardId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "level", type: "uint256" },
          { name: "elo", type: "uint256" },
          { name: "statsSum", type: "uint256" },
          { name: "timestamp", type: "uint256" },
          { name: "attestedBy", type: "address" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;

// --- LoanVault ---
export const LOAN_VAULT_ABI = [
  {
    type: "function",
    name: "createLoan",
    inputs: [
      { name: "loanId", type: "bytes32" },
      { name: "shardId", type: "bytes32" },
      { name: "principal", type: "uint256" },
      { name: "interestBps", type: "uint256" },
      { name: "duration", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "fundLoan",
    inputs: [{ name: "loanId", type: "bytes32" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "repayLoan",
    inputs: [{ name: "loanId", type: "bytes32" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "liquidate",
    inputs: [{ name: "loanId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelLoan",
    inputs: [{ name: "loanId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getLoan",
    inputs: [{ name: "loanId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "loanId", type: "bytes32" },
          { name: "shardId", type: "bytes32" },
          { name: "borrower", type: "address" },
          { name: "lender", type: "address" },
          { name: "principal", type: "uint256" },
          { name: "interestBps", type: "uint256" },
          { name: "duration", type: "uint256" },
          { name: "fundedAt", type: "uint256" },
          { name: "collateralValue", type: "uint256" },
          { name: "state", type: "uint8" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRepaymentAmount",
    inputs: [{ name: "loanId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isExpired",
    inputs: [{ name: "loanId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isLiquidatable",
    inputs: [{ name: "loanId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "LoanListed",
    inputs: [
      { name: "loanId", type: "bytes32", indexed: true },
      { name: "shardId", type: "bytes32", indexed: true },
      { name: "borrower", type: "address", indexed: true },
      { name: "principal", type: "uint256", indexed: false },
      { name: "interestBps", type: "uint256", indexed: false },
      { name: "duration", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LoanFunded",
    inputs: [
      { name: "loanId", type: "bytes32", indexed: true },
      { name: "lender", type: "address", indexed: true },
      { name: "principal", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LoanRepaid",
    inputs: [
      { name: "loanId", type: "bytes32", indexed: true },
      { name: "totalRepaid", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LoanLiquidated",
    inputs: [
      { name: "loanId", type: "bytes32", indexed: true },
      { name: "lender", type: "address", indexed: true },
      { name: "shardId", type: "bytes32", indexed: true },
    ],
  },
] as const;

export const SHARD_REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_SHARD_REGISTRY_ADDRESS as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

export const KEEPER_STAKING_ADDRESS =
  (process.env.NEXT_PUBLIC_KEEPER_STAKING_ADDRESS as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

export const BATTLE_SETTLEMENT_ADDRESS =
  (process.env.NEXT_PUBLIC_BATTLE_SETTLEMENT_ADDRESS as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

export const SIPHON_IDENTITY_ADDRESS =
  (process.env.NEXT_PUBLIC_SIPHON_IDENTITY_ADDRESS as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

export const SHARD_VALUATION_ADDRESS =
  (process.env.NEXT_PUBLIC_SHARD_VALUATION_ADDRESS as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

export const LOAN_VAULT_ADDRESS =
  (process.env.NEXT_PUBLIC_LOAN_VAULT_ADDRESS as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

export const SUBSCRIPTION_STAKING_ADDRESS =
  (process.env.NEXT_PUBLIC_SUBSCRIPTION_STAKING_ADDRESS as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

export const SHARD_MARKETPLACE_ADDRESS =
  (process.env.NEXT_PUBLIC_SHARD_MARKETPLACE_ADDRESS as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

export const SWARM_REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_SWARM_REGISTRY_ADDRESS as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

export const BOUNTY_BOARD_ADDRESS =
  (process.env.NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

// USDC on Base Sepolia
export const USDC_ADDRESS =
  (process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`) ??
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// --- USDC (minimal ERC20) ---
export const USDC_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// --- SubscriptionStaking ---
export const SUBSCRIPTION_STAKING_ABI = [
  {
    type: "function",
    name: "stake",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "unstake",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getTier",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getStake",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "amount", type: "uint256" },
          { name: "tier", type: "uint8" },
          { name: "stakedAt", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Staked",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "tier", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Unstaked",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

// --- ShardMarketplace ---
export const SHARD_MARKETPLACE_ABI = [
  {
    type: "function",
    name: "listShard",
    inputs: [
      { name: "shardId", type: "bytes32" },
      { name: "price", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "buyShard",
    inputs: [{ name: "shardId", type: "bytes32" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "cancelListing",
    inputs: [{ name: "shardId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getListing",
    inputs: [{ name: "shardId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "seller", type: "address" },
          { name: "price", type: "uint256" },
          { name: "listedAt", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ShardListed",
    inputs: [
      { name: "shardId", type: "bytes32", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "price", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ShardSold",
    inputs: [
      { name: "shardId", type: "bytes32", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "price", type: "uint256", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ListingCancelled",
    inputs: [
      { name: "shardId", type: "bytes32", indexed: true },
      { name: "seller", type: "address", indexed: true },
    ],
  },
] as const;

// --- SwarmRegistry ---
export const SWARM_REGISTRY_ABI = [
  {
    type: "function",
    name: "createSwarm",
    inputs: [
      { name: "swarmId", type: "bytes32" },
      { name: "shardIds", type: "bytes32[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "dissolveSwarm",
    inputs: [{ name: "swarmId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getSwarm",
    inputs: [{ name: "swarmId", type: "bytes32" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "shardIds", type: "bytes32[]" },
      { name: "createdAt", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "SwarmCreated",
    inputs: [
      { name: "swarmId", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "size", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SwarmDissolved",
    inputs: [
      { name: "swarmId", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true },
    ],
  },
] as const;

// --- BountyBoard ---
export const BOUNTY_BOARD_ABI = [
  {
    type: "function",
    name: "postBounty",
    inputs: [
      { name: "bountyId", type: "bytes32" },
      { name: "description", type: "string" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "claimBounty",
    inputs: [
      { name: "bountyId", type: "bytes32" },
      { name: "shardOrSwarmId", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "completeBounty",
    inputs: [{ name: "bountyId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelBounty",
    inputs: [{ name: "bountyId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "disputeBounty",
    inputs: [{ name: "bountyId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getBounty",
    inputs: [{ name: "bountyId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "bountyId", type: "bytes32" },
          { name: "poster", type: "address" },
          { name: "claimant", type: "address" },
          { name: "claimantShardOrSwarmId", type: "bytes32" },
          { name: "reward", type: "uint256" },
          { name: "description", type: "string" },
          { name: "deadline", type: "uint256" },
          { name: "state", type: "uint8" },
          { name: "createdAt", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "BountyPosted",
    inputs: [
      { name: "bountyId", type: "bytes32", indexed: true },
      { name: "poster", type: "address", indexed: true },
      { name: "reward", type: "uint256", indexed: false },
      { name: "deadline", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BountyCompleted",
    inputs: [
      { name: "bountyId", type: "bytes32", indexed: true },
      { name: "claimant", type: "address", indexed: true },
      { name: "reward", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BountyCancelled",
    inputs: [
      { name: "bountyId", type: "bytes32", indexed: true },
      { name: "poster", type: "address", indexed: true },
      { name: "refund", type: "uint256", indexed: false },
    ],
  },
] as const;

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

export function getWalletClient() {
  if (typeof window === "undefined" || !(window as any).ethereum) return null;
  return createWalletClient({
    chain: baseSepolia,
    transport: custom((window as any).ethereum),
  });
}

/** Convert a hex/UUID string to 0x-prefixed 32-byte hex for contract calls. */
export function idToBytes32(id: string): `0x${string}` {
  const hex = id.replace(/-/g, "").replace(/^0x/, "");
  return `0x${hex.padEnd(64, "0")}` as `0x${string}`;
}
