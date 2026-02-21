// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @notice Minimal interface used by Siphon for ERC-8004 compatible identity contracts.
interface IERC8004Identity {
    function getTokenByGenome(bytes32 genomeHash) external view returns (uint256);
    function getReputation(uint256 tokenId) external view returns (int256);
}
