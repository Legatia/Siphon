// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/ShardRegistry.sol";
import "../src/KeeperStaking.sol";
import "../src/BattleSettlement.sol";
import "../src/SiphonIdentity.sol";
import "../src/ShardValuation.sol";
import "../src/LoanVault.sol";
import "../src/SubscriptionStaking.sol";
import "../src/ShardMarketplace.sol";
import "../src/SwarmRegistry.sol";
import "../src/BountyBoard.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address usdcAddress = vm.envAddress("USDC_ADDRESS");
        vm.startBroadcast(deployerPrivateKey);

        // --- Core contracts (no dependencies) ---
        ShardRegistry registry = new ShardRegistry();
        console.log("ShardRegistry deployed at:", address(registry));

        KeeperStaking staking = new KeeperStaking();
        console.log("KeeperStaking deployed at:", address(staking));

        BattleSettlement settlement = new BattleSettlement();
        console.log("BattleSettlement deployed at:", address(settlement));

        SiphonIdentity identity = new SiphonIdentity();
        console.log("SiphonIdentity deployed at:", address(identity));

        // --- Loan protocol (depends on registry + identity) ---
        ShardValuation valuation = new ShardValuation(address(registry), address(identity));
        console.log("ShardValuation deployed at:", address(valuation));

        LoanVault vault = new LoanVault(address(registry), address(valuation));
        console.log("LoanVault deployed at:", address(vault));

        // --- New contracts ---

        // 7. SubscriptionStaking (deps: USDC address from env)
        SubscriptionStaking subStaking = new SubscriptionStaking(usdcAddress);
        console.log("SubscriptionStaking deployed at:", address(subStaking));

        // 8. ShardMarketplace (deps: registry) + approve as locker
        ShardMarketplace marketplace = new ShardMarketplace(address(registry));
        console.log("ShardMarketplace deployed at:", address(marketplace));

        // 9. SwarmRegistry (deps: registry)
        SwarmRegistry swarmRegistry = new SwarmRegistry(address(registry));
        console.log("SwarmRegistry deployed at:", address(swarmRegistry));

        // 10. BountyBoard (no deps, arbiter = deployer)
        BountyBoard bountyBoard = new BountyBoard(vm.addr(deployerPrivateKey));
        console.log("BountyBoard deployed at:", address(bountyBoard));

        // --- Post-deploy setup ---
        // Approve the deployer as a keeper for attestations
        valuation.approveKeeper(vm.addr(deployerPrivateKey));
        console.log("Deployer approved as attestation keeper");

        vm.stopBroadcast();

        // --- Print .env snippet ---
        console.log("");
        console.log("=== Add to .env ===");
        console.log("NEXT_PUBLIC_SHARD_REGISTRY_ADDRESS=", address(registry));
        console.log("NEXT_PUBLIC_KEEPER_STAKING_ADDRESS=", address(staking));
        console.log("NEXT_PUBLIC_BATTLE_SETTLEMENT_ADDRESS=", address(settlement));
        console.log("NEXT_PUBLIC_SIPHON_IDENTITY_ADDRESS=", address(identity));
        console.log("NEXT_PUBLIC_SHARD_VALUATION_ADDRESS=", address(valuation));
        console.log("NEXT_PUBLIC_LOAN_VAULT_ADDRESS=", address(vault));
        console.log("NEXT_PUBLIC_SUBSCRIPTION_STAKING_ADDRESS=", address(subStaking));
        console.log("NEXT_PUBLIC_SHARD_MARKETPLACE_ADDRESS=", address(marketplace));
        console.log("NEXT_PUBLIC_SWARM_REGISTRY_ADDRESS=", address(swarmRegistry));
        console.log("NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS=", address(bountyBoard));
    }
}
