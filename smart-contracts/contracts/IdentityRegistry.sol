// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IdentityRegistry {
    // Biến lưu trữ địa chỉ ví của Admin (Người quản lý hệ thống)
    address public admin;

    struct Identity {
        string identityHash;
        uint256 timestamp;
        bool isVerified; // KHÓA CHÍNH MỚI: Trạng thái xác minh (true/false)
    }

    mapping(address => Identity) private identities;

    // Rào chắn bảo mật: Chỉ cho phép tài khoản Admin thực hiện lệnh
    modifier onlyAdmin() {
        require(msg.sender == admin, "Nuoc song khong pham nuoc gieng: Only Admin allowed!");
        _;
    }

    // Hàm khởi tạo: Ai là người chạy lệnh deploy contract thì ví đó lập tức làm Admin
    constructor() {
        admin = msg.sender;
    }

    // Khách hàng tự đăng ký danh tính cá nhân
    function registerIdentity(string memory _hash) public {
        identities[msg.sender] = Identity({
            identityHash: _hash,
            timestamp: block.timestamp,
            isVerified: false // MẶC ĐỊNH: Đăng ký xong phải chờ duyệt, chưa verified ngay
        });
    }

    // HÀM MỚI: Dành riêng cho Admin phê duyệt/xác minh danh tính cho một ví bất kỳ
    function verifyIdentity(address user) public onlyAdmin {
        // Kiểm tra xem ví này đã từng đăng ký danh tính trước đó chưa
        require(bytes(identities[user].identityHash).length > 0, "Identity does not exist");
        
        identities[user].isVerified = true; // Chuyển trạng thái sang Đã xác minh
    }

    // Cập nhật hàm lấy dữ liệu: Trả về thêm tham số thứ 3 là trạng thái True/False
    function getIdentity(address user) public view returns (string memory, uint256, bool) {
        Identity memory id = identities[user];
        return (id.identityHash, id.timestamp, id.isVerified);
    }
}