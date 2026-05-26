"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ethers } from "ethers";
import CryptoJS from "crypto-js";
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

type UserRole = "visitor" | "admin" | "merchant";

type UserSession = {
  role: UserRole;
  name: string;
  email: string;
  phone?: string;
  signedInAt: string;
};

type IdentityStatus = "Not Registered" | "Pending" | "Verified" | "Revoked";

type IdentityResultLike = {
  0?: unknown;
  1?: unknown;
  2?: unknown;
  3?: unknown;
  4?: unknown;
};

type AuditLog = {
  id: string;
  action: string;
  walletOrDid: string;
  status: string;
  txHash: string;
  time: string;
};

const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const TX_LOG_KEY = "lotte_transaction_logs";
const APPEALS_KEY = "lotte_admin_appeals";
const PARKING_REQ_KEY = "lotte_parking_requests";

const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT ?? "";

const ACCESS_SERVICES = ["Parking", "Event Desk", "Merchant Check"];

function shortenAddress(address: string) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function makeDid(address: string) {
  if (!address) return "did:lotte:not-connected";
  return `did:lotte:${address}`;
}

function createDemoTxHash(seed: string) {
  const cleanSeed = seed.toLowerCase().replace(/[^a-f0-9]/g, "");
  const repeatedSeed = `${cleanSeed}${cleanSeed}${cleanSeed}${cleanSeed}`;
  return `0x${repeatedSeed.slice(0, 64).padEnd(64, "0")}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

function safeParseSession(value: string | null): UserSession | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<UserSession>;

    if (parsed.role !== "visitor") return null;

    return {
      role: "visitor",
      name: typeof parsed.name === "string" ? parsed.name : "Visitor",
      email: typeof parsed.email === "string" ? parsed.email : "",
      phone: typeof parsed.phone === "string" ? parsed.phone : undefined,
      signedInAt:
        typeof parsed.signedInAt === "string"
          ? parsed.signedInAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function appendAuditLog(log: AuditLog) {
  const rawLogs = window.localStorage.getItem(TX_LOG_KEY);

  try {
    const parsedLogs = rawLogs ? (JSON.parse(rawLogs) as unknown) : [];
    const currentLogs = Array.isArray(parsedLogs) ? parsedLogs : [];

    window.localStorage.setItem(
      TX_LOG_KEY,
      JSON.stringify([log, ...currentLogs]),
    );
  } catch {
    window.localStorage.setItem(TX_LOG_KEY, JSON.stringify([log]));
  }
}

function getStatusStyle(status: IdentityStatus) {
  if (status === "Verified") return "border-green-200 bg-green-50 text-green-700";
  if (status === "Revoked") return "border-red-200 bg-red-50 text-red-700";
  if (status === "Pending") return "border-yellow-200 bg-yellow-50 text-yellow-700";
  return "border-neutral-200 bg-neutral-50 text-neutral-600";
}

function getStatusDescription(status: IdentityStatus) {
  if (status === "Verified") {
    return "Your identity is approved. You can use this DID at mall service counters.";
  }

  if (status === "Pending") {
    return "Your identity request has been created. Please wait for Lotte Mall Admin approval.";
  }

  if (status === "Revoked") {
    return "Your identity has been revoked by Lotte Mall Admin. Access is no longer valid.";
  }

  return "You have not created a blockchain identity request yet.";
}

function getAccessStatus(status: IdentityStatus) {
  if (status === "Verified") return "Available";
  if (status === "Revoked") return "Access denied";
  if (status === "Pending") return "Waiting approval";
  return "Requires verification";
}

export default function VisitorWalletPage() {
  const router = useRouter();

  const [web2User, setWeb2User] = useState<UserSession | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [networkLabel, setNetworkLabel] = useState("Not connected");
  const [statusMessage, setStatusMessage] = useState(
    "Connect MetaMask to create your visitor DID.",
  );

  const [onChainStatus, setOnChainStatus] =
    useState<IdentityStatus>("Not Registered");
  const [onChainHash, setOnChainHash] = useState("");
  const [onChainCid, setOnChainCid] = useState("");
  const [onChainDate, setOnChainDate] = useState("");

  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ipfsCID, setIpfsCID] = useState("");

  const [isConnecting, setIsConnecting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedDid, setCopiedDid] = useState(false);

  const [appealReason, setAppealReason] = useState("");
  const [isAppealing, setIsAppealing] = useState(false);
  const [isAppealSubmitted, setIsAppealSubmitted] = useState(false);

  const [merchantReportReason, setMerchantReportReason] = useState("");
  const [parkingReqStatus, setParkingReqStatus] = useState<"idle" | "sent" | "approved" | "rejected">("idle");
  const [verificationPin, setVerificationPin] = useState("");

  const did = useMemo(() => makeDid(walletAddress), [walletAddress]);

  const identityHashPreview = useMemo(() => {
    if (!web2User || !walletAddress) return "Not generated yet";

    const rawData = [
      visitorName.trim(),
      visitorPhone.trim(),
      web2User.email.trim(),
      walletAddress.toLowerCase(),
    ].join("|");

    return `0x${CryptoJS.SHA256(rawData).toString()}`;
  }, [visitorName, visitorPhone, web2User, walletAddress]);

  useEffect(() => {
    const session = safeParseSession(
      window.localStorage.getItem("lotte_web2_user"),
    );

    if (!session) {
      router.push("/");
      return;
    }

    setWeb2User(session);
    setVisitorName(session.name);
    setVisitorPhone(session.phone ?? "");

    const savedNetwork = window.localStorage.getItem("lotte_network_label");
    if (savedNetwork) setNetworkLabel(savedNetwork);
  }, [router]);

  useEffect(() => {
    if (walletAddress) {
      try {
        const existingAppealsRaw = window.localStorage.getItem(APPEALS_KEY);
        if (existingAppealsRaw) {
          const currentAppeals = JSON.parse(existingAppealsRaw);
          const hasSubmitted = currentAppeals.some(
            (a: any) => a.wallet.toLowerCase() === walletAddress.toLowerCase()
          );
          setIsAppealSubmitted(hasSubmitted);
        }

        const reportsRaw = window.localStorage.getItem("lotte_merchant_reports");
        if (reportsRaw) {
          const found = JSON.parse(reportsRaw).find((r: any) => r.wallet.toLowerCase() === walletAddress.toLowerCase());
          if (found) setMerchantReportReason(found.reason);
        }

        const currentReqs = JSON.parse(window.localStorage.getItem(PARKING_REQ_KEY) || "[]");
        const foundReq = currentReqs.find((r: any) => r.wallet.toLowerCase() === walletAddress.toLowerCase());
        if (foundReq) {
          setParkingReqStatus(foundReq.status);
          setVerificationPin(foundReq.pin || "");
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [walletAddress]);

  async function fetchOnChainIdentity(address: string) {
    try {
      if (!window.ethereum) return;

      setIsSyncing(true);

      const provider = new ethers.BrowserProvider(
        window.ethereum as ethers.Eip1193Provider,
      );

      const deployedContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        contractABI.abi,
        provider,
      );

      const data = (await deployedContract.getIdentity(
        address,
      )) as IdentityResultLike;

      const hash = typeof data[0] === "string" ? data[0] : "";
      const cid = typeof data[1] === "string" ? data[1] : "";
      const timestamp =
        typeof data[2] === "bigint"
          ? Number(data[2])
          : typeof data[2] === "number"
            ? data[2]
            : 0;
      const verified = typeof data[3] === "boolean" ? data[3] : false;
      const revoked = typeof data[4] === "boolean" ? data[4] : false;

      if (!hash) {
        setOnChainStatus("Not Registered");
        setOnChainHash("");
        setOnChainCid("");
        setOnChainDate("");
        return;
      }

      setOnChainHash(hash);
      setOnChainCid(cid);
      setOnChainDate(
        timestamp > 0 ? new Date(timestamp * 1000).toLocaleString() : "On-chain",
      );

      if (revoked) {
        setOnChainStatus("Revoked");
      } else if (verified) {
        setOnChainStatus("Verified");
      } else {
        setOnChainStatus("Pending");
      }
    } catch (error) {
      console.error("Fetch on-chain error:", error);
      setStatusMessage("Could not sync identity from blockchain.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        setStatusMessage("MetaMask is not installed.");
        return;
      }

      setIsConnecting(true);
      setStatusMessage("Connecting to MetaMask...");

      const accounts = await window.ethereum.request<string[]>({
        method: "eth_requestAccounts",
      });

      const selectedAccount = accounts[0];

      if (!selectedAccount) {
        setStatusMessage("No wallet account selected.");
        return;
      }

      setWalletAddress(selectedAccount);
      window.localStorage.setItem("lotte_wallet_address", selectedAccount);

      try {
        const chainId = await window.ethereum.request<string>({
          method: "eth_chainId",
        });

        let resolvedNetwork = `Connected network: ${chainId}`;

        if (chainId === "0x7a69") resolvedNetwork = "Hardhat Localhost";
        if (chainId === "0xaa36a7") resolvedNetwork = "Sepolia Testnet";

        setNetworkLabel(resolvedNetwork);
        window.localStorage.setItem("lotte_network_label", resolvedNetwork);
      } catch {
        setNetworkLabel("MetaMask connected");
        window.localStorage.setItem("lotte_network_label", "MetaMask connected");
      }

      await fetchOnChainIdentity(selectedAccount);
      setStatusMessage(`Wallet connected: ${shortenAddress(selectedAccount)}`);
    } catch (error) {
      console.error(error);
      setStatusMessage("Wallet connection was rejected or failed.");
    } finally {
      setIsConnecting(false);
    }
  }

  async function copyDid() {
    if (!walletAddress) {
      setStatusMessage("Please connect wallet before copying DID.");
      return;
    }

    try {
      await navigator.clipboard.writeText(did);
      setCopiedDid(true);
      setStatusMessage("Visitor DID copied. You can use it at the verification desk.");

      window.setTimeout(() => setCopiedDid(false), 1800);
    } catch {
      setStatusMessage("Could not copy DID. Please copy it manually.");
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setIpfsCID("");

    if (file) {
      setStatusMessage(`Selected portrait: ${file.name}`);
    }
  }

  async function uploadToPinata() {
    if (!PINATA_JWT) {
      setStatusMessage(
        "Missing Pinata JWT. Add NEXT_PUBLIC_PINATA_JWT to .env.local first.",
      );
      return;
    }

    if (!selectedFile) {
      setStatusMessage("Please select your identity portrait first.");
      return;
    }

    try {
      setIsUploading(true);
      setStatusMessage("Uploading portrait to IPFS...");

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: formData,
      });

      const responseData = (await response.json()) as {
        IpfsHash?: string;
        error?: string;
      };

      if (!response.ok || !responseData.IpfsHash) {
        setStatusMessage(responseData.error ?? "IPFS upload failed.");
        return;
      }

      setIpfsCID(responseData.IpfsHash);
      setStatusMessage("IPFS upload successful. You can now anchor the DID request.");
    } catch (error) {
      setStatusMessage(`IPFS upload failed: ${getErrorMessage(error)}`);
    } finally {
      setIsUploading(false);
    }
  }

  async function registerWeb3Identity() {
    if (!walletAddress) {
      setStatusMessage("Please connect MetaMask wallet first.");
      return;
    }

    if (!visitorName.trim() || !visitorPhone.trim()) {
      setStatusMessage("Please complete your visitor name and phone number.");
      return;
    }

    if (!ipfsCID) {
      setStatusMessage("Please upload your portrait to IPFS first.");
      return;
    }

    try {
      if (!window.ethereum) {
        setStatusMessage("MetaMask is not installed.");
        return;
      }

      setIsRegistering(true);
      setStatusMessage("Creating visitor identity request on blockchain...");

      const provider = new ethers.BrowserProvider(
        window.ethereum as ethers.Eip1193Provider,
      );

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        contractABI.abi,
        signer,
      );

      const tx = await contract.registerIdentity(identityHashPreview, ipfsCID);
      await tx.wait();

      setStatusMessage(
        "DID request created successfully. Waiting for Lotte Mall Admin approval.",
      );

      appendAuditLog({
        id: `${Date.now()}`,
        action: "Register Identity Request",
        walletOrDid: did,
        status: "Pending",
        txHash: typeof tx.hash === "string" ? tx.hash : createDemoTxHash(did),
        time: new Date().toLocaleString(),
      });

      await fetchOnChainIdentity(walletAddress);
    } catch (error) {
      console.error(error);
      setStatusMessage(`Blockchain registration failed: ${getErrorMessage(error)}`);
    } finally {
      setIsRegistering(false);
    }
  }

  async function syncIdentity() {
    if (!walletAddress) {
      setStatusMessage("Please connect wallet before syncing.");
      return;
    }

    setStatusMessage("Syncing latest identity status from blockchain...");
    await fetchOnChainIdentity(walletAddress);

    const currentReqs = JSON.parse(window.localStorage.getItem(PARKING_REQ_KEY) || "[]");
    const foundReq = currentReqs.find((r: any) => r.wallet.toLowerCase() === walletAddress.toLowerCase());
    if (foundReq) setParkingReqStatus(foundReq.status);

    setStatusMessage("Identity status synced.");
  }

  const handleSubmitAppeal = () => {
    if (!appealReason.trim()) {
      setStatusMessage("Please clarify the reason for your account appeal case.");
      return;
    }
    setIsAppealing(true);
    try {
      const existingAppealsRaw = window.localStorage.getItem(APPEALS_KEY);
      const currentAppeals = existingAppealsRaw ? JSON.parse(existingAppealsRaw) : [];
      
      const newAppeal = {
        id: `appeal-${Date.now()}`,
        wallet: walletAddress,
        name: web2User?.name || "Visitor User",
        reason: appealReason.trim(),
        time: new Date().toLocaleString()
      };
      
      window.localStorage.setItem(APPEALS_KEY, JSON.stringify([newAppeal, ...currentAppeals]));
      
      appendAuditLog({
        id: `audit-appeal-${Date.now()}`,
        action: "Appeal Transmitted",
        walletOrDid: did,
        status: "Pending Review",
        txHash: createDemoTxHash(`${walletAddress}-appeal`),
        time: new Date().toLocaleString()
      });

      setAppealReason("");
      setIsAppealSubmitted(true);
      setStatusMessage("✅ Appeal case registered. System Admin will evaluate your deployment validity parameters.");
    } catch (e) {
      console.error(e);
      setStatusMessage("Failed to log account resolution form parameters.");
    } finally {
      setIsAppealing(false);
    }
  };

  const handleRequestServiceCheck = () => {
    if (!walletAddress) { setStatusMessage("Please connect wallet first."); return; }
    if (onChainStatus !== "Verified") { setStatusMessage("❌ Tài khoản phải VERIFIED mới có thể check-in."); return; }

    try {
      const generatedPin = String(Math.floor(1000 + Math.random() * 9000));
      const currentReqs = JSON.parse(window.localStorage.getItem(PARKING_REQ_KEY) || "[]");
      const filtered = currentReqs.filter((r: any) => r.wallet.toLowerCase() !== walletAddress.toLowerCase());
      
      const newReq = {
        id: `req-${Date.now()}`,
        wallet: walletAddress,
        name: visitorName,
        ipfsCid: onChainCid,
        service: "Parking Gate",
        status: "sent",
        pin: generatedPin,
        time: new Date().toLocaleTimeString()
      };

      window.localStorage.setItem(PARKING_REQ_KEY, JSON.stringify([newReq, ...filtered]));
      setVerificationPin(generatedPin);
      setParkingReqStatus("sent");
      setStatusMessage(`📡 Đã phát tín hiệu check-in. Hãy cung cấp mã PIN ${generatedPin} cho nhân viên.`);
    } catch (err) {
      console.error(err);
    }
  };

  function handleLogout() {
    window.localStorage.removeItem("lotte_web2_user");
    window.localStorage.removeItem("lotte_wallet_address");
    router.push("/");
  }

  if (!web2User) return null;

  return (
    <main className="min-h-screen bg-[#fff8f6] text-[#151515]">
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-[#fff4f1] to-[#ffe3df]">
        <div className="absolute left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-[#E30613]/20 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[500px] w-[500px] rounded-full bg-[#E30613]/25 blur-3xl" />
        <div className="absolute right-[10%] top-28 hidden h-44 w-44 rotate-12 rounded-[3rem] bg-[#E30613]/10 lg:block" />

        <div className="relative mx-auto max-w-7xl px-6 py-7">
          <nav className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <Link href="/visitor" className="group flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-[#E30613] text-3xl font-black text-white shadow-xl shadow-red-200 transition-transform group-hover:scale-105">
                L
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-[#E30613]">
                  Lotte Mall West Lake
                </p>
                <h1 className="text-xl font-black tracking-tight transition-colors group-hover:text-[#E30613] md:text-2xl">
                  Visitor DID Wallet
                </h1>
              </div>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/verify"
                className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm transition hover:border-[#E30613] hover:text-[#E30613]"
              >
                Check My DID
              </Link>
              <Link
                href="/transactions"
                className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm transition hover:border-[#E30613] hover:text-[#E30613]"
              >
                Audit Log
              </Link>
              <button
                onClick={connectWallet}
                className="rounded-full bg-[#E30613] px-5 py-3 text-sm font-black text-white shadow-xl shadow-red-200 transition hover:-translate-y-0.5"
              >
                {walletAddress ? shortenAddress(walletAddress) : "Connect Wallet"}
              </button>
              
              {/* ✅ GIỮ NGUYÊN NÚT LOGOUT GỐC THEO ẢNH CHỤP MÀN HÌNH CỦA BẠN */}
              <button
                onClick={handleLogout}
                className="rounded-full border border-neutral-200 bg-neutral-100 px-5 py-3 text-sm font-black text-neutral-500 shadow-sm transition hover:bg-neutral-200"
              >
                Logout
              </button>
            </div>
          </nav>

          <div className="grid gap-12 pb-16 pt-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-red-100 bg-white/85 px-5 py-3 text-sm font-black text-[#E30613] shadow-sm">
                <span className="h-3 w-3 rounded-full bg-[#E30613]" />
                Visitor Digital Identity
              </div>
              <h2 className="max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.055em] md:text-7xl">
                Your mall identity, <span className="text-[#E30613]">without exposing private data.</span>
              </h2>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-neutral-700">
                Connect your wallet, create a visitor DID request, and use it for
                mall-wide verification after Lotte Mall Admin approval.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button onClick={connectWallet} className="rounded-2xl bg-[#E30613] px-6 py-4 text-sm font-black text-white shadow-xl shadow-red-200 transition hover:-translate-y-0.5">
                  Connect MetaMask
                </button>
                <button onClick={copyDid} className="rounded-2xl border border-red-100 bg-white px-6 py-4 text-sm font-black text-[#E30613] shadow-sm transition hover:-translate-y-0.5">
                  {copiedDid ? "DID Copied" : "Copy DID"}
                </button>
                <button onClick={syncIdentity} disabled={!walletAddress} className="rounded-2xl border border-neutral-200 bg-white px-6 py-4 text-sm font-black text-neutral-900 shadow-sm transition hover:-translate-y-0.5">
                  Sync Status
                </button>
              </div>

              <div className="mt-8 rounded-[1.75rem] border border-red-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-400">System Message</p>
                <p className="mt-2 font-bold text-neutral-900">{statusMessage}</p>
              </div>
            </div>

            <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-2xl shadow-red-100">
              <div className="rounded-[2rem] bg-gradient-to-br from-[#E30613] via-[#ce0010] to-[#790006] p-7 text-white">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase opacity-60 tracking-widest">Lotte Visitor DID Card</p>
                    <h3 className="mt-4 text-3xl font-black tracking-tight">{walletAddress ? "Digital Wallet Active" : "Wallet Required"}</h3>
                  </div>
                  <div className="rounded-2xl bg-white/15 px-4 py-3 text-right">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-white/50">Status</p>
                    <p className="mt-1 text-sm font-black text-white">{onChainStatus}</p>
                  </div>
                </div>

                <div className="mt-8 grid gap-4 rounded-[1.5rem] bg-white/10 p-5 backdrop-blur">
                  <IdentityRow label="Visitor DID" value={did} />
                  <IdentityRow label="Wallet Address" value={walletAddress || "Not connected"} />
                  <IdentityRow label="Network" value={networkLabel} />
                  <IdentityRow label="Identity Hash" value={onChainHash || identityHashPreview} />
                  <IdentityRow label="IPFS CID" value={onChainCid || ipfsCID || "No portrait uploaded yet"} />
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <MiniCard title="Role" value="Visitor" />
                <MiniCard title="On-chain" value="Hash + status" />
                <MiniCard title="Raw PII" value="Hidden" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {!walletAddress ? (
        <section className="mx-auto max-w-7xl px-6 py-14">
          <div className="rounded-[2.5rem] border border-red-100 bg-white p-8 shadow-xl shadow-red-50">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">Step 01</p>
            <h2 className="mt-2 text-4xl font-black tracking-tight">Connect wallet first.</h2>
            <button onClick={connectWallet} className="mt-7 rounded-2xl bg-[#E30613] px-7 py-4 text-sm font-black text-white shadow-xl shadow-red-200 transition hover:-translate-y-0.5">
              Connect MetaMask Wallet
            </button>
          </div>
        </section>
      ) : onChainStatus === "Not Registered" ? (
        <section className="mx-auto max-w-7xl px-6 py-14">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-sm">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">Create Request</p>
              <h2 className="mt-2 text-4xl font-black tracking-tight">Create Lotte DID request.</h2>
              <div className="mt-6 space-y-4">
                <ProfileItem label="Visitor Name" value={visitorName} />
                <ProfileItem label="Phone Number" value={visitorPhone || "Not provided"} />
                <ProfileItem label="Email" value={web2User.email} />
                <ProfileItem label="Visitor DID" value={did} />
              </div>
            </div>

            <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-sm">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">Identity Proof</p>
              <h2 className="mt-2 text-4xl font-black tracking-tight">IPFS portrait + hash.</h2>
              <input type="file" accept="image/*" onChange={handleFileChange} className="mt-2 w-full rounded-2xl border border-neutral-200 bg-[#fffaf8] px-4 py-3 text-sm font-bold outline-none" />
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <button onClick={uploadToPinata} disabled={!selectedFile} className="rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5">Generate IPFS CID</button>
                <button onClick={registerWeb3Identity} disabled={!ipfsCID} className="rounded-2xl bg-[#111] px-5 py-4 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5">Anchor DID Request</button>
              </div>
              <div className="mt-6 rounded-[2rem] border border-neutral-100 bg-[#fffaf8] p-5">
                <ResultRow label="Generated Hash Preview" value={identityHashPreview} />
                <ResultRow label="IPFS CID" value={ipfsCID || "No CID generated yet"} />
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-7xl px-6 py-14">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-sm">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">Visitor Profile</p>
              <h2 className="mt-2 text-4xl font-black tracking-tight">Identity overview.</h2>
              <div className="mt-6 space-y-4">
                <ProfileItem label="Visitor Name" value={web2User.name} />
                <ProfileItem label="Visitor DID" value={did} />
                <ProfileItem label="Linked Wallet" value={walletAddress} />
              </div>

              <div className={`mt-6 rounded-3xl border p-5 ${getStatusStyle(onChainStatus)}`}>
                <p className="text-sm font-black uppercase tracking-[0.25em]">Verification Status</p>
                <p className="mt-2 text-3xl font-black">{onChainStatus}</p>
                <p className="mt-3 text-sm font-bold opacity-80">{getStatusDescription(onChainStatus)}</p>
              </div>

              {onChainStatus === "Revoked" && (
                <div className="mt-6 rounded-[2rem] border border-red-200 bg-red-50/40 p-5">
                  <label className="block text-xs font-black uppercase tracking-[0.22em] text-red-700">File Appeal / Report Case to Admin</label>
                  {isAppealSubmitted ? (
                    <div className="mt-4 p-4 rounded-xl border border-amber-200 bg-amber-50 text-center font-bold text-amber-700 text-sm leading-6">
                      ⏳ Your account statement has been registered! Please wait for Lotte Mall Admin review to re-evaluate status.
                    </div>
                  ) : (
                    <>
                      {merchantReportReason && (
                        <p className="mb-3 text-xs font-bold text-red-700 bg-red-50 p-3 rounded-xl border border-red-100">
                          <strong>Reason for Lock:</strong> "{merchantReportReason}"
                        </p>
                      )}
                      <textarea value={appealReason} onChange={(e) => setAppealReason(e.target.value)} placeholder="Enter your explanation line..." className="mt-3 w-full h-24 rounded-2xl border border-red-200 bg-white p-4 text-sm font-medium text-neutral-800 outline-none resize-none" />
                      <button onClick={handleSubmitAppeal} className="mt-3 w-full rounded-2xl bg-[#E30613] py-3.5 text-center text-xs font-black uppercase tracking-wider text-white shadow-md transition hover:-translate-y-0.5">Submit Appeal Data Form</button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-sm">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">Mall Access</p>
              <h2 className="mt-2 text-4xl font-black tracking-tight">Services linked to this DID.</h2>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {ACCESS_SERVICES.map((service) => (
                  <AccessCard key={service} title={service} status={getAccessStatus(onChainStatus)} />
                ))}
              </div>

              {onChainStatus === "Verified" && (
                <div className="mt-6 rounded-[2rem] border border-blue-100 bg-blue-50/20 p-5 shadow-sm">
                  <h3 className="text-xs font-black uppercase text-blue-900 tracking-wider">⚡ Lotte Smart Access Portal Check-In</h3>
                  <p className="text-[11px] font-medium text-neutral-500 mt-1">Gửi tín hiệu check-in kèm mã PIN đối soát 4 chữ số bảo mật để chống việc hệ thống bị duyệt nhầm.</p>
                  <div className="mt-3">
                    {parkingReqStatus === "idle" && (
                      <button onClick={handleRequestServiceCheck} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase py-2.5 tracking-wider shadow-sm">
                        Request Station Check-In
                      </button>
                    )}
                    {parkingReqStatus === "sent" && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 text-center rounded-xl">
                        <p className="text-[10px] font-bold text-yellow-800">📡 Signal broadcasted successfully. Mã PIN:</p>
                        <div className="mt-1 bg-white px-4 py-1.5 inline-block rounded-lg border text-base font-black text-[#E30613] tracking-widest">{verificationPin}</div>
                      </div>
                    )}
                    {parkingReqStatus === "approved" && (
                      <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-center font-bold text-xs rounded-xl">
                        ✅ Approved! Quầy dịch vụ xác thực thành công, mời bạn vào sảnh.
                        <button onClick={() => setParkingReqStatus("idle")} className="block mx-auto mt-1 text-[10px] underline font-black text-green-700">Tạo phiên mới</button>
                      </div>
                    )}
                    {parkingReqStatus === "rejected" && (
                      <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-center font-bold text-xs rounded-xl">
                        ❌ Refused. Thử lại hoặc đồng bộ lại ví.
                        <button onClick={() => setParkingReqStatus("idle")} className="block mx-auto mt-1 text-[10px] underline font-black text-green-700">Thử lại</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {onChainCid ? (
                <div className="mt-6 rounded-[2rem] border border-red-100 bg-[#fffaf8] p-5">
                  <p className="text-sm font-black uppercase tracking-[0.28em] text-[#E30613]">IPFS Portrait</p>
                  <img src={`https://ipfs.io/ipfs/${onChainCid}`} alt="Visitor portrait" className="mt-4 h-56 w-full rounded-2xl border border-red-100 object-cover shadow-sm" />
                </div>
              ) : null}
            </div>
          </div>
        </section>
      )}
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

function MiniCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#fff4f1] p-4">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-[#E30613]">{title}</p>
      <p className="mt-2 break-words text-lg font-black text-[#111]">{value}</p>
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
      <h3 className="text-lg font-black">{title}</h3>
      <p className={`mt-2 text-sm font-bold ${status === "Available" ? "text-green-600" : "text-[#E30613]"}`}>{status}</p>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-400">{label}</p>
      <p className="mt-2 break-all font-mono text-sm font-black text-neutral-950">{value}</p>
    </div>
  );
}