// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/SummonEscrow.sol";

/// @notice Deploys the SummonEscrow contract for the gacha/summon system.
contract DeploySummonEscrow is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        // Tier costs: Rare = 0.005 ETH, Elite = 0.02 ETH, Legendary = 0.05 ETH
        uint256 rareCost = 0.005 ether;
        uint256 eliteCost = 0.02 ether;
        uint256 legendaryCost = 0.05 ether;

        vm.startBroadcast(deployerPrivateKey);

        address escrow = address(new SummonEscrow(rareCost, eliteCost, legendaryCost));
        console.log("SummonEscrow deployed at:", escrow);

        vm.stopBroadcast();

        console.log("");
        console.log("=== Add to .env ===");
        console.log("NEXT_PUBLIC_SUMMON_ESCROW_ADDRESS=", escrow);
    }
}
