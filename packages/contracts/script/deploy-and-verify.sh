#!/usr/bin/env bash
# Deploy all Siphon contracts to Base Sepolia and verify on Basescan.
#
# Required env vars:
#   DEPLOYER_PRIVATE_KEY  - private key for deployer account
#   USDC_ADDRESS          - USDC token address on target chain
#   BASESCAN_API_KEY      - API key from basescan.org for verification
#
# Optional:
#   ARBITER_ADDRESS       - address of the arbiter for attestations
#   RPC_URL               - override default Base Sepolia RPC
#
# Usage:
#   cd packages/contracts
#   chmod +x script/deploy-and-verify.sh
#   ./script/deploy-and-verify.sh

set -euo pipefail

RPC_URL="${RPC_URL:-https://sepolia.base.org}"
CHAIN_ID=84532

if [ -z "${DEPLOYER_PRIVATE_KEY:-}" ]; then
  echo "Error: DEPLOYER_PRIVATE_KEY is required" && exit 1
fi
if [ -z "${USDC_ADDRESS:-}" ]; then
  echo "Error: USDC_ADDRESS is required" && exit 1
fi
if [ -z "${BASESCAN_API_KEY:-}" ]; then
  echo "Warning: BASESCAN_API_KEY not set — skipping verification"
  SKIP_VERIFY=true
else
  SKIP_VERIFY=false
fi

echo "=== Deploying to Base Sepolia ==="

# Deploy
OUTPUT=$(forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --slow \
  -vvv 2>&1)

echo "$OUTPUT"

# Extract deployed addresses from forge output
extract_address() {
  echo "$OUTPUT" | grep "$1 deployed at:" | grep -oE '0x[a-fA-F0-9]{40}' | tail -1
}

REGISTRY=$(extract_address "ShardRegistry")
STAKING=$(extract_address "KeeperStaking")
SETTLEMENT=$(extract_address "BattleSettlement")
IDENTITY=$(extract_address "SiphonIdentity")
VALUATION=$(extract_address "ShardValuation")
VAULT=$(extract_address "LoanVault")
SUB_STAKING=$(extract_address "SubscriptionStaking")
MARKETPLACE=$(extract_address "ShardMarketplace")
SWARM=$(extract_address "SwarmRegistry")
BOUNTY=$(extract_address "BountyBoard")

if [ "$SKIP_VERIFY" = true ]; then
  echo "Skipping verification (no BASESCAN_API_KEY)"
  exit 0
fi

echo ""
echo "=== Verifying contracts on Basescan ==="

DEPLOYER_ADDRESS=$(cast wallet address "$DEPLOYER_PRIVATE_KEY" 2>/dev/null || echo "unknown")

verify() {
  local name=$1
  local addr=$2
  shift 2
  local args=("$@")

  echo "Verifying $name at $addr..."
  forge verify-contract "$addr" "src/$name.sol:$name" \
    --chain-id $CHAIN_ID \
    --etherscan-api-key "$BASESCAN_API_KEY" \
    --watch \
    "${args[@]}" 2>&1 || echo "  Warning: verification of $name may have failed"
}

# Contracts with no constructor args
verify "ShardRegistry" "$REGISTRY"
verify "KeeperStaking" "$STAKING"
verify "BattleSettlement" "$SETTLEMENT"
verify "SiphonIdentity" "$IDENTITY"

# Contracts with constructor args
verify "ShardValuation" "$VALUATION" --constructor-args "$(cast abi-encode 'constructor(address,address)' "$REGISTRY" "$IDENTITY")"
verify "LoanVault" "$VAULT" --constructor-args "$(cast abi-encode 'constructor(address,address)' "$REGISTRY" "$VALUATION")"
verify "SubscriptionStaking" "$SUB_STAKING" --constructor-args "$(cast abi-encode 'constructor(address)' "$USDC_ADDRESS")"
verify "ShardMarketplace" "$MARKETPLACE" --constructor-args "$(cast abi-encode 'constructor(address)' "$REGISTRY")"
verify "SwarmRegistry" "$SWARM" --constructor-args "$(cast abi-encode 'constructor(address)' "$REGISTRY")"
verify "BountyBoard" "$BOUNTY" --constructor-args "$(cast abi-encode 'constructor(address)' "$DEPLOYER_ADDRESS")"

echo ""
echo "=== Verification complete ==="
