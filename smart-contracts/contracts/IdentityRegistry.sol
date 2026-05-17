// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IdentityRegistry {

    struct Identity {
        string identityHash;
        uint256 timestamp;
    }

    mapping(address => Identity) private identities;

    function registerIdentity(string memory _hash) public {
        identities[msg.sender] = Identity({
            identityHash: _hash,
            timestamp: block.timestamp
        });
    }

    function getIdentity(address user) public view returns (string memory, uint256) {
        Identity memory id = identities[user];
        return (id.identityHash, id.timestamp);
    }
}