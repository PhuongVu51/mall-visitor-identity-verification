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
  // --- STATE TỪ CẢ 2 BẠN ---
  const [walletAddress, setWalletAddress] = useState("");
  const [networkLabel, setNetworkLabel] = useState("Not connected");
  const [statusMessage, setStatusMessage] = useState(
    "Connect MetaMask to start the visitor identity flow."
  );

  // Logic Tech của Phương
  const [contract, setContract] = useState<any>(null);
  const [identity, setIdentity] = useState("");
  const [searchAddress, setSearchAddress] = useState("");
  const [resultHash, setResultHash] = useState("");
  const [resultTimestamp, setResultTimestamp] = useState("");

  const contractAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

  // --- EFFECT (UI của bạn kia) ---
  useEffect(() => {
    const savedWallet = window.localStorage.getItem("lotte_wallet_address");
    const savedNetwork = window.localStorage.getItem("lotte_network_label");

    if (savedWallet) {
      // NOTE: Bạn có thể tự động gọi lại connectWallet ở đây nếu muốn
      setWalletAddress(savedWallet);
      setStatusMessage(`Wallet loaded from cache. Please Connect again to sync Contract.`);
    }

    if (savedNetwork) {
      setNetworkLabel(savedNetwork);
    }
  }, []);

  // --- LOGIC: CONNECT WALLET (Đã gộp của Phương & Bạn kia) ---
  async function connectWallet() {
    try {
      if (!window.ethereum) {
        setStatusMessage("❌ MetaMask is not installed.");
        return;
      }

      // Khởi tạo Ethers (Code của Phương)
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const accounts = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      
      const deployedContract = new ethers.Contract(
        contractAddress,
        contractABI.abi,
        signer
      );

      const selectedAccount = accounts[0];

      // Cập nhật State
      setWalletAddress(selectedAccount);
      setContract(deployedContract);
      window.localStorage.setItem("lotte_wallet_address", selectedAccount);

      // Cập nhật Network Label (Code của bạn kia nhưng dùng Ethers)
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

  // --- LOGIC: REGISTER IDENTITY (Của Phương) ---
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
      console.log("Generated Hash:", identityHash);

      const tx = await contract.registerIdentity(identityHash);
      setStatusMessage("⏳ Waiting for transaction...");
      await tx.wait();

      setStatusMessage("✅ Identity registered successfully");
      setIdentity("");
    } catch (err: any) {
      console.error(err);
      setStatusMessage("❌ Transaction failed: " + (err.reason || err.message));
    }
  }

  // --- LOGIC: FETCH IDENTITY (Của Phương) ---
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

      const data = await contract.getIdentity(searchAddress);
      console.log("Blockchain Data:", data);

      const hash = data[0];
      const timestamp = Number(data[1]);

      if (!hash || hash === "" || timestamp === 0) {
        setStatusMessage("❌ No identity found");
        return;
      }

      setResultHash(hash);
      const date = new Date(timestamp * 1000);
      setResultTimestamp(date.toLocaleString());

      setStatusMessage("✅ Identity fetched successfully");
    } catch (err: any) {
      console.error(err);
      setStatusMessage("❌ Fetch failed: " + (err.reason || err.message));
    }
  }

  // --- UI GIAO DIỆN CHÍNH ---
  return (
    <main className="min-h-screen bg-[#fff8f6] text-[#151515]">
      {/* HEADER & HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-[#fff4f1] to-[#ffe1dc]">
        <div className="absolute left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-[#E30613]/20 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[480px] w-[480px] rounded-full bg-[#E30613]/25 blur-3xl" />
        
        <div className="relative mx-auto max-w-7xl px-6 py-7">
          {/* NAV BAR */}
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

          {/* HERO CONTENT */}
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
                A Web3 identity verification prototype for Lotte Mall West Lake, allowing visitors to prove verification status across parking, event desks, cinema counters, and merchants.
              </p>

              {/* KHU VỰC THÔNG BÁO STATUS */}
              <div className="mt-9 max-w-2xl rounded-[1.75rem] border border-red-100 bg-white/80 p-5 shadow-sm backdrop-blur">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-400">
                  Current system status
                </p>
                <p className={`mt-2 break-all text-base font-bold ${statusMessage.includes("❌") ? "text-red-500" : "text-neutral-900"}`}>
                  {statusMessage}
                </p>
              </div>
            </div>

            {/* VISITOR DID CARD */}
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
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KHU VỰC FORM LOGIC CỦA PHƯƠNG (Tích hợp giao diện mới) */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 text-center">
           <h2 className="text-3xl font-black tracking-tight">Interactive Smart Contract Demo</h2>
           <p className="mt-2 text-neutral-600">Test the on-chain register and verify functions directly.</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* CỘT ĐĂNG KÝ */}
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

          {/* CỘT TÌM KIẾM */}
          <div className="rounded-[2rem] border border-red-100 bg-white p-8 shadow-sm">
            <h3 className="mb-6 text-xl font-black text-[#E30613]">2. Verify On-Chain</h3>
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
              Fetch & Verify Identity
            </button>

            {/* KẾT QUẢ TÌM KIẾM */}
            {resultHash && (
              <div className="mt-6 rounded-2xl bg-[#fff4f1] p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#E30613]">On-Chain Hash:</p>
                <p className="mt-1 break-all text-sm font-bold">{resultHash}</p>
                <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-[#E30613]">Timestamp:</p>
                <p className="mt-1 text-sm font-bold">{resultTimestamp}</p>
              </div>
            )}
          </div>
        </div>
      </section>
      
      {/* CÁC PHẦN GIỚI THIỆU KHÁC CỦA BẠN KIA */}
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <ModuleCard href="/visitor" eyebrow="Visitor" title="DID Wallet" description="Displays wallet address, DID, identity hash..." icon="🪪" />
          <ModuleCard href="/admin" eyebrow="Lotte Admin" title="Register Identity" description="Creates a visitor identity hash..." icon="🏢" />
          <ModuleCard href="/verify" eyebrow="Merchant" title="Verify Visitor" description="Checks visitor DID or wallet address..." icon="✅" />
          <ModuleCard href="/transactions" eyebrow="Blockchain" title="Transaction Log" description="Shows audit trail actions." icon="⛓️" />
        </div>
      </section>

    </main>
  );
}

// --- SUB-COMPONENTS CỦA GIAO DIỆN ---
function IdentityRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.24em] text-white/45">{label}</p>
      <p className="mt-1 break-all text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function ModuleCard({ href, eyebrow, title, description, icon }: { href: string; eyebrow: string; title: string; description: string; icon: string; }) {
  return (
    <Link href={href} className="group rounded-[2rem] border border-red-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#E30613] hover:shadow-2xl">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff4f1] text-2xl transition group-hover:bg-[#E30613]">{icon}</div>
      <p className="mt-6 text-xs font-black uppercase tracking-[0.28em] text-[#E30613]">{eyebrow}</p>
      <h3 className="mt-3 text-2xl font-black tracking-tight">{title}</h3>
      <p className="mt-3 leading-7 text-neutral-600">{description}</p>
      <p className="mt-6 font-black text-[#E30613]">Open module →</p>
    </Link>
  );
}