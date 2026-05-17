// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IdentityRegistry {
    address public admin;

    struct Identity {
        string identityHash;
        uint256 timestamp;
        bool isVerified;
        bool isRevoked; 
    }

    mapping(address => Identity) private identities;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only Admin allowed");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function registerIdentity(string memory _hash) public {
        identities[msg.sender] = Identity({
            identityHash: _hash,
            timestamp: block.timestamp,
            isVerified: false,
            isRevoked: false
        });
    }

    function verifyIdentity(address user) public onlyAdmin {
        require(bytes(identities[user].identityHash).length > 0, "Identity does not exist");
        identities[user].isVerified = true;
        identities[user].isRevoked = false;
    }

    function revokeIdentity(address user) public onlyAdmin {
        require(bytes(identities[user].identityHash).length > 0, "Identity does not exist");
        identities[user].isVerified = false;
        identities[user].isRevoked = true;
    }

    function getIdentity(address user) public view returns (string memory, uint256, bool, bool) {
        Identity memory id = identities[user];
        return (id.identityHash, id.timestamp, id.isVerified, id.isRevoked);
    }
}