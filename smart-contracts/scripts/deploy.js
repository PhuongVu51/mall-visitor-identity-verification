const hre = require("hardhat");

async function main() {
  // Gọi đúng tên Contract của nhóm Jolista
  const IdentityRegistry = await hre.ethers.getContractFactory("IdentityRegistry");

  // Triển khai lên mạng (Contract siêu đơn giản nên không cần tham số gì cả)
  const registry = await IdentityRegistry.deploy();

  await registry.waitForDeployment();
  
  console.log(`✅ Contract deployed to: ${await registry.getAddress()}`);
}

// Xử lý lỗi
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});