import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import contractABI from "../constants/contractABI.json";

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

type IdentityStatus = "Not Registered" | "Pending" | "Verified" | "Revoked";

const contractAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";

function shortenAddress(address: string) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function makeDid(address: string) {
  if (!address) return "did:lotte:not-connected";
  return `did:lotte:${address}`;
}

function getStatusStyle(status: IdentityStatus) {
  if (status === "Verified") return "bg-green-100 text-green-700 border-green-200";
  if (status === "Revoked") return "bg-red-100 text-red-700 border-red-200";
  if (status === "Pending") return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-neutral-100 text-neutral-600 border-neutral-200";
}

export default function VisitorWalletPage() {
  const [walletAddress, setWalletAddress] = useState("");
  const [networkLabel, setNetworkLabel] = useState("Not connected");
  const [statusMessage, setStatusMessage] = useState(
    "Connect MetaMask to view your visitor digital identity."
  );

  // --- WEB3 STATES ---
  const [onChainStatus, setOnChainStatus] = useState<IdentityStatus>("Not Registered");
  const [onChainHash, setOnChainHash] = useState("");
  const [onChainDate, setOnChainDate] = useState("");

  const did = useMemo(() => makeDid(walletAddress), [walletAddress]);
  const currentAccess = ["Parking", "Event Desk", "Merchant Check"];

  useEffect(() => {
    const savedWallet = window.localStorage.getItem("lotte_wallet_address");
    const savedNetwork = window.localStorage.getItem("lotte_network_label");

    if (savedWallet) {
      setWalletAddress(savedWallet);
      setStatusMessage(`Wallet loaded from storage. Reconnect to sync Blockchain.`);
      fetchOnChainIdentity(savedWallet); // Lấy dữ liệu ngay khi load trang
    }

    if (savedNetwork) setNetworkLabel(savedNetwork);
  }, []);

  // --- LOGIC: FETCH BLOCKCHAIN DATA ---
  async function fetchOnChainIdentity(address: string) {
    try {
      if (!window.ethereum) return;
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const deployedContract = new ethers.Contract(contractAddress, contractABI.abi, provider);
      
      const data = await deployedContract.getIdentity(address);
      const hash = data[0];
      const timestamp = Number(data[1]);
      const verified = data[2];
      const revoked = data[3];

      if (!hash || hash === "") {
        setOnChainStatus("Not Registered");
        setOnChainHash("");
        setOnChainDate("");
      } else {
        setOnChainHash(hash);
        setOnChainDate(new Date(timestamp * 1000).toLocaleString());
        
        if (revoked) setOnChainStatus("Revoked");
        else if (verified) setOnChainStatus("Verified");
        else setOnChainStatus("Pending");
      }
    } catch (err) {
      console.error("Fetch on-chain error:", err);
    }
  }

  // --- LOGIC: CONNECT WALLET ---
  async function connectWallet() {
    try {
      if (!window.ethereum) {
        setStatusMessage("MetaMask is not installed. Please install MetaMask first.");
        return;
      }
      const accounts = await window.ethereum.request<string[]>({ method: "eth_requestAccounts" });
      const selectedAccount = accounts[0];

      if (!selectedAccount) {
        setStatusMessage("No wallet account selected.");
        return;
      }

      setWalletAddress(selectedAccount);
      window.localStorage.setItem("lotte_wallet_address", selectedAccount);

      try {
        const chainId = await window.ethereum.request<string>({ method: "eth_chainId" });
        let resolvedNetwork = `Connected network: ${chainId}`;
        if (chainId === "0x7a69") resolvedNetwork = "Hardhat Localhost";
        if (chainId === "0xaa36a7") resolvedNetwork = "Sepolia Testnet";
        setNetworkLabel(resolvedNetwork);
        window.localStorage.setItem("lotte_network_label", resolvedNetwork);
      } catch {
        setNetworkLabel("MetaMask connected");
      }

      setStatusMessage(`Wallet connected: ${selectedAccount}`);
      // Lấy dữ liệu blockchain ngay sau khi kết nối
      await fetchOnChainIdentity(selectedAccount);

    } catch {
      setStatusMessage("Wallet connection was rejected or failed.");
    }
  }

  return (
    <main className="min-h-screen bg-[#fff8f6] text-[#151515]">
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-[#fff4f1] to-[#ffe3df]">
        <div className="absolute left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-[#E30613]/20 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[480px] w-[480px] rounded-full bg-[#E30613]/25 blur-3xl" />
        
        <div className="relative mx-auto max-w-7xl px-6 py-7">
          <nav className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <Link href="/" className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-[#E30613] text-3xl font-black text-white shadow-xl shadow-red-200">L</div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-[#E30613]">Lotte Mall West Lake</p>
                <h1 className="text-xl font-black tracking-tight md:text-2xl">Visitor DID Wallet</h1>
              </div>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/" className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm backdrop-blur transition hover:border-[#E30613] hover:text-[#E30613]">Home</Link>
              <Link href="/admin" className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm backdrop-blur transition hover:border-[#E30613] hover:text-[#E30613]">Admin Portal</Link>
              <button onClick={connectWallet} className="rounded-full bg-[#E30613] px-5 py-3 text-sm font-black text-white shadow-xl shadow-red-200 transition hover:-translate-y-0.5 hover:bg-[#bd000a]">
                Connect Wallet
              </button>
            </div>
          </nav>

          <div className="grid gap-12 pb-16 pt-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-red-100 bg-white/85 px-5 py-3 text-sm font-black text-[#E30613] shadow-sm">
                <span className="flex h-3 w-3 rounded-full bg-[#E30613]" /> Visitor Digital Identity
              </div>
              <h2 className="max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.055em] text-[#111] md:text-7xl">
                Your mall identity, <span className="text-[#E30613]">without exposing private data.</span>
              </h2>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-neutral-700 md:text-xl md:leading-9">
                This page pulls real data from the Blockchain. Name and phone number are hidden to protect privacy.
              </p>

              <div className="mt-9 flex flex-wrap gap-4">
                <button onClick={connectWallet} className="rounded-2xl bg-[#E30613] px-7 py-4 text-base font-black text-white shadow-2xl transition hover:-translate-y-1 hover:bg-[#bd000a]">
                  Sync Wallet Data
                </button>
                <Link href="/verify" className="rounded-2xl border border-neutral-200 bg-white px-7 py-4 text-base font-black text-neutral-950 shadow-sm transition hover:-translate-y-1 hover:border-[#E30613] hover:text-[#E30613]">
                  Test Verification Check
                </Link>
              </div>

              <div className="mt-9 max-w-2xl rounded-[1.75rem] border border-red-100 bg-white/80 p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-400">Visitor wallet status</p>
                <p className="mt-2 break-all text-base font-bold text-neutral-900">{statusMessage}</p>
              </div>
            </div>

            <div className="relative">
              <div className="relative overflow-hidden rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-2xl">
                <div className="rounded-[2rem] bg-gradient-to-br from-[#E30613] via-[#ce0010] to-[#790006] p-7 text-white">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.32em] text-white/55">Lotte Visitor DID</p>
                      <h3 className="mt-4 text-3xl font-black tracking-tight">{walletAddress ? "Digital Wallet Active" : "Wallet Required"}</h3>
                    </div>
                  </div>
                  <div className="mt-8 rounded-[1.5rem] bg-white/10 p-5 backdrop-blur flex flex-col gap-4">
                    <IdentityRow label="Visitor DID" value={did} />
                    <IdentityRow label="Wallet Address" value={walletAddress ? walletAddress : "..."} />
                    <IdentityRow label="Identity Hash (On-Chain)" value={onChainHash || "No hash found"} />
                    <IdentityRow label="Network" value={networkLabel} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-14 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">Visitor profile</p>
          <h2 className="mt-2 text-4xl font-black tracking-tight">Identity overview</h2>

          <div className="mt-6 space-y-4">
            {/* 💡 ĐIỂM ĂN TIỀN ĐỒ ÁN: Tên được ẩn đi để chứng minh tính bảo mật */}
            <ProfileItem label="Visitor Name" value="*** Protected (Off-chain) ***" />
            <ProfileItem label="Visitor Type" value="Lotte Mall Visitor" />
            <ProfileItem label="Issued At (Blockchain)" value={onChainDate || "Waiting for registration"} />
            <ProfileItem label="DID Format" value={`did:lotte:${walletAddress ? shortenAddress(walletAddress) : "..."}`} />
          </div>

          <div className={`mt-6 rounded-3xl border p-5 ${getStatusStyle(onChainStatus)}`}>
            <p className="text-sm font-black uppercase tracking-[0.25em]">Current Status</p>
            <p className="mt-2 text-3xl font-black">{onChainStatus}</p>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">Mall access</p>
              <h2 className="mt-2 text-4xl font-black tracking-tight">Services linked to this DID</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {currentAccess.map((item) => (
              <AccessCard
                key={item}
                title={item}
                status={onChainStatus === "Verified" ? "Available" : "Requires verification"}
              />
            ))}
          </div>

          <div className="mt-6 rounded-[2rem] bg-[#111] p-6 text-white">
            <p className="text-sm font-black uppercase tracking-[0.28em] text-white/45">Privacy note</p>
            <h3 className="mt-3 text-2xl font-black">Personal information is hidden.</h3>
            <p className="mt-4 leading-7 text-white/70">
              As you can see, no raw data (Name, Phone) is pulled from the blockchain. Merchants only verify the Hash and your Verification Status.
            </p>
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
function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-[#fffaf8] p-4">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-400">{label}</p>
      <p className="mt-2 break-all text-base font-black text-neutral-950">{value}</p>
    </div>
  );
}
function AccessCard({ title, status }: { title: string; status: string }) {
  return (
    <div className="rounded-[1.5rem] border border-red-100 bg-[#fffaf8] p-5">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
        {title.includes("Parking") ? "🅿️" : title.includes("Event") ? "🎟️" : "🏬"}
      </div>
      <h3 className="mt-4 text-xl font-black">{title}</h3>
      <p className={`mt-2 text-sm font-bold ${status === "Available" ? "text-green-600" : "text-[#E30613]"}`}>{status}</p>
    </div>
  );
}