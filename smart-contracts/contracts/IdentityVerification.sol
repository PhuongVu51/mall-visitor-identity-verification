// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract IdentityVerification {

    struct Identity {
        string identityHash;
        uint256 timestamp;
    }

    mapping(address => Identity) public identities;

    event IdentityRegistered(
        address indexed user,
        string identityHash,
        uint256 timestamp
    );

    function registerIdentity(string memory _identityHash) public {

        identities[msg.sender] = Identity({
            identityHash: _identityHash,
            timestamp: block.timestamp
        });

        emit IdentityRegistered(
            msg.sender,
            _identityHash,
            block.timestamp
        );
    }

    function getIdentity(address user)
        public
        view
        returns (string memory, uint256)
    {
        Identity memory identity = identities[user];

        return (
            identity.identityHash,
            identity.timestamp
        );
    }
}