// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/ShardRegistry.sol";
import "../src/SiphonIdentity.sol";
import "../src/ShardValuation.sol";

contract ShardValuationTest is Test {
    ShardRegistry public registry;
    SiphonIdentity public identity;
    ShardValuation public valuation;

    address public governance = makeAddr("governance");
    address public keeper = makeAddr("keeper");
    address public alice = makeAddr("alice");

    bytes32 public shardId1 = keccak256("shard1");
    bytes32 public genomeHash1 = keccak256("genome1");

    function setUp() public {
        registry = new ShardRegistry();
        identity = new SiphonIdentity();

        vm.prank(governance);
        valuation = new ShardValuation(address(registry), address(identity));

        // Approve keeper
        vm.prank(governance);
        valuation.approveKeeper(keeper);

        // Alice registers a shard
        vm.prank(alice);
        registry.register(shardId1, genomeHash1);
    }

    function test_AttestAndValue() public {
        vm.prank(keeper);
        valuation.attest(shardId1, 10, 1400, 350);

        uint256 value = valuation.valueShard(shardId1);

        // BASE_VALUE + 9 * LEVEL_BONUS + 200 * ELO_BONUS_PER_POINT + 0 rep
        // 0.01 + 9*0.002 + 200*0.00001 = 0.01 + 0.018 + 0.002 = 0.03 ether
        assertEq(value, 0.03 ether);
    }

    function test_AttestEmitsEvent() public {
        vm.prank(keeper);
        vm.expectEmit(true, true, false, true);
        emit ShardValuation.Attested(shardId1, keeper, 10, 1400, 350);
        valuation.attest(shardId1, 10, 1400, 350);
    }

    function test_ValueWithReputation() public {
        // Mint identity token and add reputation
        vm.prank(alice);
        uint256 tokenId = identity.mintAgent(genomeHash1);

        // Add 10 reputation points
        identity.updateReputation(tokenId, 10);

        vm.prank(keeper);
        valuation.attest(shardId1, 1, 1200, 300);

        uint256 value = valuation.valueShard(shardId1);

        // BASE_VALUE + 0 level bonus + 0 ELO bonus + 10 * REP_BONUS
        // 0.01 + 0 + 0 + 10 * 0.001 = 0.02 ether
        assertEq(value, 0.02 ether);
    }

    function test_ValueLevel1ELO1200() public {
        // Minimum stats: level 1, ELO 1200, no reputation
        vm.prank(keeper);
        valuation.attest(shardId1, 1, 1200, 265);

        uint256 value = valuation.valueShard(shardId1);
        assertEq(value, 0.01 ether); // just base value
    }

    function test_ValueHighLevel() public {
        vm.prank(keeper);
        valuation.attest(shardId1, 100, 2500, 500);

        uint256 value = valuation.valueShard(shardId1);

        // BASE + 99*LEVEL + 1300*ELO_BONUS + 0 rep
        // 0.01 + 99*0.002 + 1300*0.00001 = 0.01 + 0.198 + 0.013 = 0.221 ether
        assertEq(value, 0.221 ether);
    }

    function test_RevertNoAttestation() public {
        vm.expectRevert("No attestation");
        valuation.valueShard(shardId1);
    }

    function test_RevertExpiredAttestation() public {
        vm.prank(keeper);
        valuation.attest(shardId1, 10, 1400, 350);

        // Fast forward past TTL
        vm.warp(block.timestamp + 8 days);

        vm.expectRevert("Attestation expired");
        valuation.valueShard(shardId1);
    }

    function test_HasValidAttestation() public {
        assertFalse(valuation.hasValidAttestation(shardId1));

        vm.prank(keeper);
        valuation.attest(shardId1, 10, 1400, 350);
        assertTrue(valuation.hasValidAttestation(shardId1));

        vm.warp(block.timestamp + 8 days);
        assertFalse(valuation.hasValidAttestation(shardId1));
    }

    function test_RevertUnapprovedKeeper() public {
        vm.prank(alice);
        vm.expectRevert("Not approved keeper");
        valuation.attest(shardId1, 10, 1400, 350);
    }

    function test_RevertInvalidLevel() public {
        vm.prank(keeper);
        vm.expectRevert("Invalid level");
        valuation.attest(shardId1, 0, 1400, 350);
    }

    function test_RevertInvalidELO() public {
        vm.prank(keeper);
        vm.expectRevert("Invalid ELO");
        valuation.attest(shardId1, 10, 50, 350);
    }

    function test_RemoveKeeper() public {
        vm.prank(governance);
        valuation.removeKeeper(keeper);

        vm.prank(keeper);
        vm.expectRevert("Not approved keeper");
        valuation.attest(shardId1, 10, 1400, 350);
    }

    function test_GetAttestation() public {
        vm.prank(keeper);
        valuation.attest(shardId1, 50, 1800, 400);

        ShardValuation.Attestation memory a = valuation.getAttestation(shardId1);
        assertEq(a.level, 50);
        assertEq(a.elo, 1800);
        assertEq(a.statsSum, 400);
        assertEq(a.attestedBy, keeper);
    }
}
