"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import CryptoJS from "crypto-js";
import contractABI from "../constants/contractABI.json";

// --- GLOBAL & HELPERS ---
type EthereumRequestArgs = {
  method: string;
  params?: unknown[];
};

type EthereumProvider = {
  request: <T = unknown>(args: EthereumRequestArgs) => Promise<T>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

function shortenAddress(address: string) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function makeDid(address: string) {
  if (!address) return "did:lotte:not-connected";
  return `did:lotte:${address}`;
}

export default function Home() {
  // --- STATES ---
  const [walletAddress, setWalletAddress] = useState("");
  const [networkLabel, setNetworkLabel] = useState("Not connected");
  const [statusMessage, setStatusMessage] = useState(
    "Connect MetaMask to start the visitor identity flow."
  );

  const [contract, setContract] = useState<any>(null);
  const [identity, setIdentity] = useState("");
  const [searchAddress, setSearchAddress] = useState("");
  const [resultHash, setResultHash] = useState("");
  const [resultTimestamp, setResultTimestamp] = useState("");
  const [resultVerified, setResultVerified] = useState<boolean | null>(null);
  const [resultRevoked, setResultRevoked] = useState<boolean | null>(null); // STATE MỚI: Bắt trạng thái Revoked
  
  const [adminAddress, setAdminAddress] = useState(""); 

  // CONTRACT ADDRESS 
  const contractAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";

  // --- EFFECT ---
  useEffect(() => {
    const savedWallet = window.localStorage.getItem("lotte_wallet_address");
    const savedNetwork = window.localStorage.getItem("lotte_network_label");

    if (savedWallet) {
      setWalletAddress(savedWallet);
      setStatusMessage(`Wallet loaded from cache. Please Connect again to sync Contract.`);
    }

    if (savedNetwork) {
      setNetworkLabel(savedNetwork);
    }
  }, []);

  // --- LOGIC: CONNECT WALLET ---
  async function connectWallet() {
    try {
      if (!window.ethereum) {
        setStatusMessage("❌ MetaMask is not installed.");
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const accounts = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      
      const deployedContract = new ethers.Contract(
        contractAddress,
        contractABI.abi,
        signer
      );

      const selectedAccount = accounts[0];

      setWalletAddress(selectedAccount);
      setContract(deployedContract);
      window.localStorage.setItem("lotte_wallet_address", selectedAccount);

      try {
        const adminWallet = await deployedContract.admin();
        setAdminAddress(adminWallet.toLowerCase());
      } catch (err) {
        console.error("Could not fetch admin:", err);
      }

      try {
        const network = await provider.getNetwork();
        const chainIdHex = "0x" + network.chainId.toString(16);
        let resolvedNetwork = `Connected network: ${chainIdHex}`;

        if (chainIdHex === "0x7a69" || network.chainId === 31337n) {
          resolvedNetwork = "Hardhat Localhost";
        } else if (chainIdHex === "0xaa36a7") {
          resolvedNetwork = "Sepolia Testnet";
        }

        setNetworkLabel(resolvedNetwork);
        window.localStorage.setItem("lotte_network_label", resolvedNetwork);
      } catch (e) {
        setNetworkLabel("MetaMask connected");
      }

      setStatusMessage(`✅ Wallet connected successfully`);
    } catch (err: any) {
      console.error(err);
      setStatusMessage("❌ Wallet connection failed or rejected.");
    }
  }

  // --- LOGIC: REGISTER IDENTITY ---
  async function registerIdentity() {
    try {
      if (!contract) {
        setStatusMessage("❌ Contract not loaded. Please Connect Wallet.");
        return;
      }
      if (!identity.trim()) {
        setStatusMessage("❌ Please enter identity");
        return;
      }

      const identityHash = "0x" + CryptoJS.SHA256(identity).toString();
      
      const tx = await contract.registerIdentity(identityHash);
      setStatusMessage("⏳ Waiting for transaction...");
      await tx.wait();

      setStatusMessage("✅ Identity registered successfully! Waiting for Admin approval.");
      setIdentity("");
    } catch (err: any) {
      console.error(err);
      setStatusMessage("❌ Transaction failed: " + (err.reason || err.message));
    }
  }

  // --- LOGIC: FETCH IDENTITY ---
  async function fetchIdentity() {
    try {
      if (!contract) {
        setStatusMessage("❌ Contract not loaded. Please Connect Wallet.");
        return;
      }
      if (!searchAddress.trim()) {
        setStatusMessage("❌ Please enter wallet address");
        return;
      }
      if (!ethers.isAddress(searchAddress)) {
        setStatusMessage("❌ Invalid wallet address");
        return;
      }

      setResultHash("");
      setResultTimestamp("");
      setResultVerified(null);
      setResultRevoked(null); // Reset state

      // LẤY DỮ LIỆU TỪ BLOCKCHAIN: Lấy đủ 4 tham số
      const data = await contract.getIdentity(searchAddress);

      const hash = data[0];
      const timestamp = Number(data[1]);
      const verified = data[2];
      const revoked = data[3]; // CHÍNH LÀ NÓ: Bắt cờ Revoked từ mạng lưới

      if (!hash || hash === "" || timestamp === 0) {
        setStatusMessage("❌ No identity found for this address.");
        return;
      }

      setResultHash(hash);
      setResultVerified(verified);
      setResultRevoked(revoked); // Đẩy vào State
      const date = new Date(timestamp * 1000);
      setResultTimestamp(date.toLocaleString());

      setStatusMessage("✅ Identity fetched successfully");
    } catch (err: any) {
      console.error(err);
      setStatusMessage("❌ Fetch failed: " + (err.reason || err.message));
    }
  }

  // --- LOGIC: ADMIN APPROVE IDENTITY ---
  async function approveIdentity() {
    try {
      if (!contract) {
        setStatusMessage("❌ Contract not loaded.");
        return;
      }
      
      setStatusMessage("⏳ Admin is approving identity on blockchain...");
      const tx = await contract.verifyIdentity(searchAddress);
      await tx.wait();
      
      setStatusMessage("✅ Identity verified successfully!");
      await fetchIdentity();
    } catch (err: any) {
      console.error(err);
      setStatusMessage("❌ Admin action failed: " + (err.reason || err.message));
    }
  }

  const isAdminConnected = walletAddress.toLowerCase() === adminAddress;

  return (
    <main className="min-h-screen bg-[#fff8f6] text-[#151515]">
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-[#fff4f1] to-[#ffe1dc]">
        <div className="absolute left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-[#E30613]/20 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[480px] w-[480px] rounded-full bg-[#E30613]/25 blur-3xl" />
        
        <div className="relative mx-auto max-w-7xl px-6 py-7">
          <nav className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-[#E30613] text-3xl font-black text-white shadow-xl shadow-red-200">
                L
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-[#E30613]">
                  Lotte Mall West Lake
                </p>
                <h1 className="text-xl font-black tracking-tight md:text-2xl">
                  Visitor Identity Verification
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/visitor" className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-[#E30613] hover:text-[#E30613] hover:shadow-md">
                Visitor Wallet
              </Link>
              <Link href="/admin" className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-[#E30613] hover:text-[#E30613] hover:shadow-md">
                Admin Portal
              </Link>
              <Link href="/verify" className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-[#E30613] hover:text-[#E30613] hover:shadow-md">
                Verify
              </Link>
              <button
                onClick={connectWallet}
                className="rounded-full bg-[#E30613] px-5 py-3 text-sm font-black text-white shadow-xl shadow-red-200 transition hover:-translate-y-0.5 hover:bg-[#bd000a]"
              >
                {walletAddress ? "Reconnect Wallet" : "Connect Wallet"}
              </button>
            </div>
          </nav>

          <div className="grid gap-12 pb-20 pt-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-red-100 bg-white/85 px-5 py-3 text-sm font-black text-[#E30613] shadow-sm backdrop-blur">
                <span className="flex h-3 w-3 rounded-full bg-[#E30613]" />
                Blockchain-based Identity Management System
              </div>
              <h2 className="max-w-5xl text-5xl font-black leading-[0.98] tracking-[-0.055em] text-[#111] md:text-7xl">
                One visitor identity for <span className="text-[#E30613]">mall-wide verification.</span>
              </h2>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-neutral-700 md:text-xl md:leading-9">
                A Web3 identity verification prototype for Lotte Mall West Lake, kết hợp giữa mã hóa bảo mật thông tin và phân quyền xác thực minh bạch.
              </p>

              <div className="mt-9 max-w-2xl rounded-[1.75rem] border border-red-100 bg-white/80 p-5 shadow-sm backdrop-blur">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-400">
                  Current system status
                </p>
                <p className={`mt-2 break-all text-base font-bold ${statusMessage.includes("❌") ? "text-red-500" : "text-neutral-900"}`}>
                  {statusMessage}
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="relative overflow-hidden rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-2xl shadow-red-100">
                <div className="rounded-[2rem] bg-gradient-to-br from-[#E30613] via-[#ce0010] to-[#790006] p-7 text-white">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.32em] text-white/55">
                        Visitor DID Card
                      </p>
                      <h3 className="mt-4 text-3xl font-black tracking-tight">
                        {walletAddress ? "Wallet Connected" : "Waiting for Wallet"}
                      </h3>
                    </div>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl">
                      🔐
                    </div>
                  </div>

                  <div className="mt-8 space-y-4 rounded-[1.5rem] bg-white/10 p-5 backdrop-blur">
                    <IdentityRow label="Wallet Address" value={shortenAddress(walletAddress)} />
                    <IdentityRow label="Visitor DID" value={makeDid(walletAddress)} />
                    <IdentityRow label="Network" value={networkLabel} />
                    <IdentityRow label="Role" value={isAdminConnected ? "Admin" : (walletAddress ? "Visitor" : "None")} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 text-center">
           <h2 className="text-3xl font-black tracking-tight">Interactive Smart Contract Demo</h2>
           <p className="mt-2 text-neutral-600">Kiểm tra luồng đăng ký và phê duyệt danh tính.</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-[2rem] border border-red-100 bg-white p-8 shadow-sm">
            <h3 className="mb-6 text-xl font-black text-[#E30613]">1. Register Identity</h3>
            <input
              type="text"
              placeholder="Enter Private Identity (e.g. phuong123)"
              className="w-full rounded-xl border border-neutral-200 bg-[#fffaf8] p-4 text-sm font-medium outline-none transition focus:border-[#E30613] focus:ring-1 focus:ring-[#E30613]"
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
            />
            <button
              onClick={registerIdentity}
              className="mt-4 w-full rounded-xl bg-[#111] py-4 text-sm font-black text-white transition hover:bg-[#E30613]"
            >
              Hash & Register to Blockchain
            </button>
          </div>

          <div className="rounded-[2rem] border border-red-100 bg-white p-8 shadow-sm">
            <h3 className="mb-6 text-xl font-black text-[#E30613]">2. Verify & Approve On-Chain</h3>
            <input
              type="text"
              placeholder="Enter Wallet Address (0x...)"
              className="w-full rounded-xl border border-neutral-200 bg-[#fffaf8] p-4 text-sm font-medium outline-none transition focus:border-[#E30613] focus:ring-1 focus:ring-[#E30613]"
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
            />
            <button
              onClick={fetchIdentity}
              className="mt-4 w-full rounded-xl bg-[#111] py-4 text-sm font-black text-white transition hover:bg-[#E30613]"
            >
              Fetch Identity Data
            </button>

            {resultHash && (
              <div className="mt-6 rounded-2xl bg-[#fff4f1] p-5 border border-red-100">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#E30613]">On-Chain Hash:</p>
                <p className="break-all text-sm font-bold mt-1">{resultHash}</p>
                
                <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-[#E30613]">Timestamp:</p>
                <p className="text-sm font-bold mt-1">{resultTimestamp}</p>

                <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-[#E30613]">Verification Status:</p>
                {/* LOGIC MỚI: Ưu tiên bắt cờ Revoked đầu tiên */}
                <p className={`text-base font-black mt-1 ${resultRevoked ? "text-red-600" : resultVerified ? "text-green-600" : "text-amber-500"}`}>
                  {resultRevoked ? "Revoked ❌" : resultVerified ? "Verified ✅" : "Pending Approval ⏳"}
                </p>

                {/* LOGIC ĐIỀU KIỆN: Ẩn nút Approve đi nếu tài khoản ĐÃ BỊ THU HỒI */}
                {!resultVerified && !resultRevoked && isAdminConnected && (
                  <button
                    onClick={approveIdentity}
                    className="mt-5 w-full rounded-xl bg-red-600 py-3 text-sm font-black text-white transition hover:bg-red-700 shadow-md shadow-red-200"
                  >
                    Approve Identity
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function IdentityRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.24em] text-white/45">{label}</p>
      <p className="mt-1 break-all text-sm font-bold text-white">{value}</p>
    </div>
  );
}