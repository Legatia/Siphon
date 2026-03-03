// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/SubscriptionStaking.sol";
import "../src/ShardMarketplace.sol";
import "../src/SwarmRegistry.sol";
import "../src/BountyBoard.sol";

/// @notice Deploys the 4 contracts missing from the initial deployment.
contract DeployRemaining is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address usdcAddress = vm.envAddress("USDC_ADDRESS");
        address registry = vm.envAddress("SHARD_REGISTRY_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        address subStaking = address(new SubscriptionStaking(usdcAddress));
        console.log("SubscriptionStaking deployed at:", subStaking);

        address marketplace = address(new ShardMarketplace(registry));
        console.log("ShardMarketplace deployed at:", marketplace);

        address swarmRegistry = address(new SwarmRegistry(registry));
        console.log("SwarmRegistry deployed at:", swarmRegistry);

        address bountyBoard = address(new BountyBoard(deployer));
        console.log("BountyBoard deployed at:", bountyBoard);

        vm.stopBroadcast();

        console.log("");
        console.log("=== Add to .env ===");
        console.log("NEXT_PUBLIC_SUBSCRIPTION_STAKING_ADDRESS=", subStaking);
        console.log("NEXT_PUBLIC_SHARD_MARKETPLACE_ADDRESS=", marketplace);
        console.log("NEXT_PUBLIC_SWARM_REGISTRY_ADDRESS=", swarmRegistry);
        console.log("NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS=", bountyBoard);
    }
}
