// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/SiphonIdentity.sol";

contract SiphonIdentityTest is Test {
    SiphonIdentity public identity;
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    bytes32 public genome1 = keccak256("genome1");
    bytes32 public genome2 = keccak256("genome2");

    function setUp() public {
        identity = new SiphonIdentity();
    }

    function test_MintAgent() public {
        vm.prank(alice);
        uint256 tokenId = identity.mintAgent(genome1);

        assertEq(tokenId, 1);
        SiphonIdentity.AgentRecord memory agent = identity.getAgent(tokenId);
        assertEq(agent.genomeHash, genome1);
        assertEq(agent.owner, alice);
        assertEq(agent.reputation, 0);
        assertEq(agent.validationCount, 0);
        assertGt(agent.mintedAt, 0);
    }

    function test_MintEmitsEvents() public {
        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit SiphonIdentity.AgentMinted(1, genome1, alice);
        identity.mintAgent(genome1);
    }

    function test_RevertDoubleMint() public {
        vm.prank(alice);
        identity.mintAgent(genome1);

        vm.prank(bob);
        vm.expectRevert("Genome already minted");
        identity.mintAgent(genome1);
    }

    function test_GenomeToToken() public {
        vm.prank(alice);
        uint256 tokenId = identity.mintAgent(genome1);

        assertEq(identity.getTokenByGenome(genome1), tokenId);
    }

    function test_OwnerTokenCount() public {
        vm.startPrank(alice);
        identity.mintAgent(genome1);
        identity.mintAgent(genome2);
        vm.stopPrank();

        assertEq(identity.getOwnerTokenCount(alice), 2);
    }

    function test_UpdateReputation() public {
        vm.prank(alice);
        uint256 tokenId = identity.mintAgent(genome1);

        identity.updateReputation(tokenId, 10);
        assertEq(identity.getReputation(tokenId), 10);

        identity.updateReputation(tokenId, -3);
        assertEq(identity.getReputation(tokenId), 7);
    }

    function test_ReputationEmitsEvent() public {
        vm.prank(alice);
        uint256 tokenId = identity.mintAgent(genome1);

        vm.expectEmit(true, false, false, true);
        emit SiphonIdentity.ReputationUpdated(tokenId, 5, 5);
        identity.updateReputation(tokenId, 5);
    }

    function test_AddValidation() public {
        vm.prank(alice);
        uint256 tokenId = identity.mintAgent(genome1);

        vm.prank(bob);
        identity.addValidation(tokenId, true, "Good behavior");

        assertEq(identity.getValidationCount(tokenId), 1);
        assertEq(identity.getReputation(tokenId), 1);
    }

    function test_AddNegativeValidation() public {
        vm.prank(alice);
        uint256 tokenId = identity.mintAgent(genome1);

        vm.prank(bob);
        identity.addValidation(tokenId, false, "Bad behavior");

        assertEq(identity.getValidationCount(tokenId), 1);
        assertEq(identity.getReputation(tokenId), -1);
    }

    function test_SetTokenURI() public {
        vm.prank(alice);
        uint256 tokenId = identity.mintAgent(genome1);

        vm.prank(alice);
        identity.setTokenURI(tokenId, "ipfs://QmTest");

        SiphonIdentity.AgentRecord memory agent = identity.getAgent(tokenId);
        assertEq(agent.tokenURI, "ipfs://QmTest");
    }

    function test_RevertSetTokenURINotOwner() public {
        vm.prank(alice);
        uint256 tokenId = identity.mintAgent(genome1);

        vm.prank(bob);
        vm.expectRevert("Not token owner");
        identity.setTokenURI(tokenId, "ipfs://QmBad");
    }

    function test_RevertNonexistentToken() public {
        vm.expectRevert("Token does not exist");
        identity.getAgent(999);
    }
}
