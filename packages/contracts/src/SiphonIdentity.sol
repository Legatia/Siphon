// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SiphonIdentity {
    struct AgentRecord {
        bytes32 genomeHash;
        address owner;
        int256 reputation;
        uint256 validationCount;
        uint256 mintedAt;
        string tokenURI;
    }

    uint256 private _nextTokenId;
    mapping(uint256 => AgentRecord) public agents;
    mapping(bytes32 => uint256) public genomeToToken;
    mapping(address => uint256[]) public ownerTokens;

    event AgentMinted(uint256 indexed tokenId, bytes32 indexed genomeHash, address indexed owner);
    event ReputationUpdated(uint256 indexed tokenId, int256 delta, int256 newReputation);
    event ValidationAdded(uint256 indexed tokenId, address indexed validator, bool result);
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    function mintAgent(bytes32 genomeHash) external returns (uint256) {
        require(genomeToToken[genomeHash] == 0, "Genome already minted");

        _nextTokenId++;
        uint256 tokenId = _nextTokenId;

        agents[tokenId] = AgentRecord({
            genomeHash: genomeHash,
            owner: msg.sender,
            reputation: 0,
            validationCount: 0,
            mintedAt: block.timestamp,
            tokenURI: ""
        });

        genomeToToken[genomeHash] = tokenId;
        ownerTokens[msg.sender].push(tokenId);

        emit AgentMinted(tokenId, genomeHash, msg.sender);
        emit Transfer(address(0), msg.sender, tokenId);

        return tokenId;
    }

    function updateReputation(uint256 tokenId, int256 delta) external {
        require(agents[tokenId].mintedAt > 0, "Token does not exist");

        agents[tokenId].reputation += delta;

        emit ReputationUpdated(tokenId, delta, agents[tokenId].reputation);
    }

    function getReputation(uint256 tokenId) external view returns (int256) {
        require(agents[tokenId].mintedAt > 0, "Token does not exist");
        return agents[tokenId].reputation;
    }

    function addValidation(uint256 tokenId, bool result, string calldata evidence) external {
        require(agents[tokenId].mintedAt > 0, "Token does not exist");

        agents[tokenId].validationCount++;

        if (result) {
            agents[tokenId].reputation += 1;
        } else {
            agents[tokenId].reputation -= 1;
        }

        emit ValidationAdded(tokenId, msg.sender, result);
    }

    function getValidationCount(uint256 tokenId) external view returns (uint256) {
        require(agents[tokenId].mintedAt > 0, "Token does not exist");
        return agents[tokenId].validationCount;
    }

    function getAgent(uint256 tokenId) external view returns (AgentRecord memory) {
        require(agents[tokenId].mintedAt > 0, "Token does not exist");
        return agents[tokenId];
    }

    function getTokenByGenome(bytes32 genomeHash) external view returns (uint256) {
        return genomeToToken[genomeHash];
    }

    function getOwnerTokenCount(address owner) external view returns (uint256) {
        return ownerTokens[owner].length;
    }

    function setTokenURI(uint256 tokenId, string calldata uri) external {
        require(agents[tokenId].mintedAt > 0, "Token does not exist");
        require(agents[tokenId].owner == msg.sender, "Not token owner");
        agents[tokenId].tokenURI = uri;
    }
}
