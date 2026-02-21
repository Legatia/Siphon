// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/ShardRegistry.sol";
import "../src/KeeperStaking.sol";
import "../src/BattleSettlement.sol";
import "../src/ShardValuation.sol";
import "../src/LoanVault.sol";
import "../src/SubscriptionStaking.sol";
import "../src/ShardMarketplace.sol";
import "../src/SwarmRegistry.sol";
import "../src/BountyBoard.sol";

contract Deploy is Script {
    struct DeployedAddresses {
        address registry;
        address staking;
        address settlement;
        address valuation;
        address vault;
        address subStaking;
        address marketplace;
        address swarmRegistry;
        address bountyBoard;
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address usdcAddress = vm.envAddress("USDC_ADDRESS");
        uint256 deployLendingFlag = vm.envOr("DEPLOY_LENDING", uint256(0));
        bool deployLending = deployLendingFlag == 1;
        address erc8004Identity = vm.envOr("ERC8004_IDENTITY_ADDRESS", address(0));
        address deployer = vm.addr(deployerPrivateKey);
        DeployedAddresses memory deployed;

        vm.startBroadcast(deployerPrivateKey);

        // --- Core contracts (no dependencies) ---
        deployed.registry = address(new ShardRegistry());
        console.log("ShardRegistry deployed at:", deployed.registry);

        deployed.staking = address(new KeeperStaking());
        console.log("KeeperStaking deployed at:", deployed.staking);

        deployed.settlement = address(new BattleSettlement());
        console.log("BattleSettlement deployed at:", deployed.settlement);

        // --- Lending protocol (optional future milestone) ---
        if (deployLending) {
            require(erc8004Identity != address(0), "Set ERC8004_IDENTITY_ADDRESS when DEPLOY_LENDING=1");
            deployed.valuation = address(new ShardValuation(deployed.registry, erc8004Identity));
            console.log("ShardValuation deployed at:", deployed.valuation);

            deployed.vault = address(new LoanVault(deployed.registry, deployed.valuation));
            console.log("LoanVault deployed at:", deployed.vault);
        } else {
            console.log("Skipping lending deployment (DEPLOY_LENDING != 1)");
        }

        // --- New contracts ---

        // 7. SubscriptionStaking (deps: USDC address from env)
        deployed.subStaking = address(new SubscriptionStaking(usdcAddress));
        console.log("SubscriptionStaking deployed at:", deployed.subStaking);

        // 8. ShardMarketplace (deps: registry) + approve as locker
        deployed.marketplace = address(new ShardMarketplace(deployed.registry));
        console.log("ShardMarketplace deployed at:", deployed.marketplace);

        // 9. SwarmRegistry (deps: registry)
        deployed.swarmRegistry = address(new SwarmRegistry(deployed.registry));
        console.log("SwarmRegistry deployed at:", deployed.swarmRegistry);

        // 10. BountyBoard (no deps, arbiter = deployer)
        deployed.bountyBoard = address(new BountyBoard(deployer));
        console.log("BountyBoard deployed at:", deployed.bountyBoard);

        // --- Post-deploy setup ---
        if (deployLending) {
            // Approve the deployer as a keeper for attestations
            ShardValuation(deployed.valuation).approveKeeper(deployer);
            console.log("Deployer approved as attestation keeper");

            // Approve arbiter as keeper if ARBITER_ADDRESS is set
            // (the web attest route uses ARBITER_PRIVATE_KEY which may differ from deployer)
            address arbiterAddress = vm.envOr("ARBITER_ADDRESS", address(0));
            if (arbiterAddress != address(0)) {
                ShardValuation(deployed.valuation).approveKeeper(arbiterAddress);
                console.log("Arbiter approved as attestation keeper:", arbiterAddress);
            } else {
                console.log("WARNING: ARBITER_ADDRESS not set. If your arbiter differs from deployer, attestations will revert.");
            }
        }

        console.log("NOTE: Shard owners must approve lockers from their own wallet before use:");
        console.log("  ShardRegistry.approveLock(ShardMarketplace)");
        if (deployLending) {
            console.log("  ShardRegistry.approveLock(LoanVault)");
        }

        vm.stopBroadcast();

        // --- Print .env snippet ---
        console.log("");
        console.log("=== Add to .env ===");
        console.log("NEXT_PUBLIC_SHARD_REGISTRY_ADDRESS=", deployed.registry);
        console.log("NEXT_PUBLIC_KEEPER_STAKING_ADDRESS=", deployed.staking);
        console.log("NEXT_PUBLIC_BATTLE_SETTLEMENT_ADDRESS=", deployed.settlement);
        console.log("NEXT_PUBLIC_ERC8004_IDENTITY_ADDRESS=", erc8004Identity);
        console.log("NEXT_PUBLIC_SHARD_VALUATION_ADDRESS=", deployed.valuation);
        console.log("NEXT_PUBLIC_LOAN_VAULT_ADDRESS=", deployed.vault);
        console.log("NEXT_PUBLIC_SUBSCRIPTION_STAKING_ADDRESS=", deployed.subStaking);
        console.log("NEXT_PUBLIC_SHARD_MARKETPLACE_ADDRESS=", deployed.marketplace);
        console.log("NEXT_PUBLIC_SWARM_REGISTRY_ADDRESS=", deployed.swarmRegistry);
        console.log("NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS=", deployed.bountyBoard);
    }
}
