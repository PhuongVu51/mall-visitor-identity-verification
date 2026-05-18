// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IdentityRegistry {
    address public admin;

    struct Identity {
        string identityHash; // Hash của tên + SĐT
        string ipfsCID;      // MỚI: Mã băm của hình ảnh CCCD/Avatar trên IPFS
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

    // MỚI: Hàm đăng ký giờ nhận thêm tham số _ipfsCID
    function registerIdentity(string memory _hash, string memory _ipfsCID) public {
        identities[msg.sender] = Identity({
            identityHash: _hash,
            ipfsCID: _ipfsCID,
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

    // MỚI: Hàm getIdentity giờ trả về 5 tham số (thêm ipfsCID ở vị trí số 2)
    function getIdentity(address user) public view returns (string memory, string memory, uint256, bool, bool) {
        Identity memory id = identities[user];
        return (id.identityHash, id.ipfsCID, id.timestamp, id.isVerified, id.isRevoked);
    }
}