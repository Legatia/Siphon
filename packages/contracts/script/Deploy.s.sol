// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/ShardRegistry.sol";
import "../src/KeeperStaking.sol";
import "../src/BattleSettlement.sol";
import "../src/SiphonIdentity.sol";
import "../src/ShardValuation.sol";
import "../src/LoanVault.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
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
    }
}
