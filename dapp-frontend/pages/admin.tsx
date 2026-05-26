"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import contractABI from "../constants/contractABI.json";

type IdentityStatus = "None" | "Pending" | "Verified" | "Revoked";

type EthereumRequestArgs = {
  method: string;
  params?: unknown[];
};

type EthereumProvider = {
  request: <T = unknown>(args: EthereumRequestArgs) => Promise<T>;
};

type UserSession = {
  role?: "visitor" | "admin" | "merchant";
  name?: string;
  email?: string;
};

type IdentityContract = {
  getIdentity: (walletAddress: string) => Promise<unknown>;
  registerIdentity?: (walletAddress: string, identityHash: string) => Promise<ContractTransaction>;
  verifyIdentity?: (walletAddress: string) => Promise<ContractTransaction>;
  revokeIdentity?: (walletAddress: string) => Promise<ContractTransaction>;
};

type ContractTransaction = {
  hash: string;
  wait: () => Promise<unknown>;
};

type IdentityLookupResult = {
  hash: string;
  status: IdentityStatus;
  verified: boolean;
  revoked: boolean;
};

type TransactionLog = {
  id: string;
  action: string;
  wallet: string;
  status: string;
  txHash: string;
  time: string;
};

type AppealTicket = {
  id: string;
  wallet: string;
  name: string;
  reason: string;
  time: string;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const STORAGE_KEY = "lotte_transaction_logs";
const APPEALS_KEY = "lotte_admin_appeals";

function shortenAddress(address: string) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function makeDid(address: string) {
  if (!address) return "did:lotte:not-connected";
  return `did:lotte:${address}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null) {
    const maybeReason = (error as { reason?: unknown }).reason;
    const maybeMessage = (error as { message?: unknown }).message;

    if (typeof maybeReason === "string") return maybeReason;
    if (typeof maybeMessage === "string") return maybeMessage;
  }

  return "Unknown error.";
}

function isValidSession(value: string | null) {
  if (!value) return false;

  try {
    const parsed = JSON.parse(value) as UserSession;
    return parsed.role === "admin";
  } catch {
    return false;
  }
}

function parseIdentityResult(data: unknown): IdentityLookupResult {
  if (!data || !Array.isArray(data) || data[0] === undefined) {
    return {
      hash: "",
      verified: false,
      revoked: false,
      status: "None",
    };
  }

  const hash = data[0] ? String(data[0]).trim() : "";
  const verified = Boolean(data[3]);
  const revoked = Boolean(data[4]);

  let status: IdentityStatus = "None";

  if (!hash || hash === "0x" || hash === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    status = "None";
  } else if (revoked) {
    status = "Revoked";
  } else if (verified) {
    status = "Verified";
  } else {
    status = "Pending";
  }

  return {
    hash,
    verified,
    revoked,
    status,
  };
}

function readLogs(): TransactionLog[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is TransactionLog => {
      if (typeof item !== "object" || item === null) return false;

      const log = item as Partial<TransactionLog>;

      return (
        typeof log.action === "string" &&
        typeof log.status === "string" &&
        typeof log.txHash === "string" &&
        typeof log.time === "string"
      );
    });
  } catch {
    return [];
  }
}

function saveLog(log: Omit<TransactionLog, "id" | "time">) {
  const nextLog: TransactionLog = {
    ...log,
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: new Date().toLocaleTimeString(),
  };

  const currentLogs = readLogs();
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([nextLog, ...currentLogs].slice(0, 20)),
  );
}

export default function AdminPortal() {
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  const [walletAddress, setWalletAddress] = useState("");
  const [statusMessage, setStatusMessage] = useState(
    "Sign in as Lotte Mall Admin and connect MetaMask.",
  );
  const [contract, setContract] = useState<IdentityContract | null>(null);

  const [visitorName, setVisitorName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [visitorWallet, setVisitorWallet] = useState("");
  const [generatedHash, setGeneratedHash] = useState("");

  const [targetWallet, setTargetWallet] = useState("");
  const [lookupHash, setLookupHash] = useState("");
  const [currentOnChainStatus, setCurrentOnChainStatus] =
    useState<IdentityStatus>("None");

  const [isConnecting, setIsConnecting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  // ✅ ĐÃ THÊM: State lưu vết đơn khiếu nại tìm thấy của địa chỉ ví đang tra cứu
  const [activeAppeal, setActiveAppeal] = useState<AppealTicket | null>(null);

  const didPreview = useMemo(() => makeDid(visitorWallet), [visitorWallet]);

  const canRegister =
    Boolean(contract) &&
    ethers.isAddress(visitorWallet.trim()) &&
    Boolean(generatedHash);

  useEffect(() => {
    const isAdmin = isValidSession(window.localStorage.getItem("lotte_web2_user"));

    if (!isAdmin) {
      window.location.href = "/";
      return;
    }

    setIsCheckingRole(false);
  }, []);

  useEffect(() => {
    const savedWallet = window.localStorage.getItem("lotte_wallet_address");

    if (savedWallet) {
      setWalletAddress(savedWallet);
    }
  }, []);

  async function connectWallet() {
    try {
      setIsConnecting(true);

      if (!window.ethereum) {
        setStatusMessage("MetaMask is not installed.");
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();

      const selectedAccount =
        Array.isArray(accounts) && typeof accounts[0] === "string"
          ? accounts[0]
          : await signer.getAddress();

      const deployedContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        contractABI.abi,
        signer,
      ) as unknown as IdentityContract;

      setWalletAddress(selectedAccount);
      setContract(deployedContract);

      window.localStorage.setItem("lotte_wallet_address", selectedAccount);

      setStatusMessage("Admin wallet connected successfully.");
    } catch (error) {
      setStatusMessage(`Wallet connection failed: ${getErrorMessage(error)}`);
    } finally {
      setIsConnecting(false);
    }
  }

  function handleGenerateHash() {
    if (!visitorName.trim() || !phone.trim() || !email.trim()) {
      setStatusMessage("Please fill in visitor name, phone, and email.");
      return;
    }

    if (!visitorWallet.trim() || !ethers.isAddress(visitorWallet.trim())) {
      setStatusMessage("Please enter a valid visitor wallet address.");
      return;
    }

    setIsGenerating(true);

    const rawData = JSON.stringify({
      name: visitorName.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      wallet: visitorWallet.trim().toLowerCase(),
    });

    const hash = ethers.keccak256(ethers.toUtf8Bytes(rawData));

    setGeneratedHash(hash);
    setTargetWallet(visitorWallet.trim());
    setCurrentOnChainStatus("None");
    setLookupHash("");
    setActiveAppeal(null);

    setStatusMessage("Identity hash generated. Ready to register on blockchain.");
    setIsGenerating(false);
  }

  async function handleRegisterIdentity() {
    if (!contract) {
      setStatusMessage("Please connect Admin wallet first.");
      return;
    }

    if (!contract.registerIdentity) {
      setStatusMessage(
        "Smart contract ABI does not expose registerIdentity(wallet, hash). Please check your contract function name.",
      );
      return;
    }

    if (!canRegister) {
      setStatusMessage("Generate a valid identity hash before registering.");
      return;
    }

    try {
      setIsRegistering(true);
      setStatusMessage("Sending Register Identity transaction to blockchain...");

      const tx = await contract.registerIdentity(
        visitorWallet.trim(),
        generatedHash,
      );

      await tx.wait();

      saveLog({
        action: "Register Identity",
        wallet: visitorWallet.trim(),
        status: "Success",
        txHash: tx.hash,
      });

      setStatusMessage("Identity registered on blockchain successfully.");
      setTargetWallet(visitorWallet.trim());
      await checkVisitorStatus(visitorWallet.trim());
    } catch (error) {
      setStatusMessage(`Register failed: ${getErrorMessage(error)}`);
    } finally {
      setIsRegistering(false);
    }
  }

  async function checkVisitorStatus(walletFromAction?: string) {
    const walletToCheck = walletFromAction ?? targetWallet.trim();

    if (!contract) {
      setStatusMessage("Please connect Admin wallet first.");
      return;
    }

    if (!walletToCheck || !ethers.isAddress(walletToCheck)) {
      setStatusMessage("Please enter a valid visitor wallet address.");
      return;
    }

    try {
      setIsSearching(true);
      setStatusMessage("Fetching visitor status from smart contract...");

      const data = await contract.getIdentity(walletToCheck);
      const parsed = parseIdentityResult(data);

      setTargetWallet(walletToCheck);
      setLookupHash(parsed.hash);
      setCurrentOnChainStatus(parsed.status);

      // ✅ ĐÃ THÊM: Quét tìm đơn khiếu nại của địa chỉ ví này trong LocalStorage để hiển thị trực tiếp
      const appealsRaw = window.localStorage.getItem(APPEALS_KEY);
      if (appealsRaw) {
        const parsedAppeals = JSON.parse(appealsRaw) as AppealTicket[];
        const found = parsedAppeals.find(a => a.wallet.toLowerCase() === walletToCheck.toLowerCase());
        setActiveAppeal(found || null);
      } else {
        setActiveAppeal(null);
      }

      if (parsed.status === "None") {
        setStatusMessage("No registered identity found for this wallet.");
      } else if (parsed.status === "Pending") {
        setStatusMessage("Identity found. Current status: Pending approval.");
      } else if (parsed.status === "Verified") {
        setStatusMessage("Identity found. Current status: Verified.");
      } else if (parsed.status === "Revoked") {
        setStatusMessage("Identity found. Current status: Revoked.");
      }

      saveLog({
        action: "Look up Visitor",
        wallet: walletToCheck,
        status: parsed.status,
        txHash: "read-only",
      });
    } catch (error) {
      setStatusMessage(`Lookup failed: ${getErrorMessage(error)}`);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleApproveIdentity() {
    if (!contract) {
      setStatusMessage("Please connect Admin wallet first.");
      return;
    }

    if (!contract.verifyIdentity) {
      setStatusMessage(
        "Smart contract ABI does not expose verifyIdentity(wallet). Please check your contract function name.",
      );
      return;
    }

    if (!targetWallet.trim() || !ethers.isAddress(targetWallet.trim())) {
      setStatusMessage("Please enter a valid visitor wallet address.");
      return;
    }

    try {
      setIsApproving(true);
      setStatusMessage("Sending Approve Identity transaction to blockchain...");

      const tx = await contract.verifyIdentity(targetWallet.trim());
      await tx.wait();

      setStatusMessage("Identity approved successfully.");
      
      // ✅ ĐÃ THÊM: Ghi log khôi phục từ đơn khiếu nại nếu tài khoản trước đó là Revoked
      saveLog({
        action: currentOnChainStatus === "Revoked" ? "Appeal Approved / Restore" : "Approve Identity",
        wallet: targetWallet.trim(),
        status: "Verified",
        txHash: tx.hash,
      });

      // Xóa đơn khiếu nại đã giải quyết xong khỏi danh sách đệm
      const appealsRaw = window.localStorage.getItem(APPEALS_KEY);
      if (appealsRaw) {
        const parsedAppeals = JSON.parse(appealsRaw) as AppealTicket[];
        const updated = parsedAppeals.filter(a => a.wallet.toLowerCase() !== targetWallet.trim().toLowerCase());
        window.localStorage.setItem(APPEALS_KEY, JSON.stringify(updated));
      }
      setActiveAppeal(null);

      await checkVisitorStatus(targetWallet.trim());
    } catch (error) {
      setStatusMessage(`Approve failed: ${getErrorMessage(error)}`);
    } finally {
      setIsApproving(false);
    }
  }

  async function handleRevokeIdentity() {
    if (!contract) {
      setStatusMessage("Please connect Admin wallet first.");
      return;
    }

    if (!contract.revokeIdentity) {
      setStatusMessage(
        "Smart contract ABI does not expose revokeIdentity(wallet). Please check your contract function name.",
      );
      return;
    }

    if (!targetWallet.trim() || !ethers.isAddress(targetWallet.trim())) {
      setStatusMessage("Please enter a valid visitor wallet address.");
      return;
    }

    try {
      setIsRevoking(true);
      setStatusMessage("Sending Revoke Identity transaction to blockchain...");

      const tx = await contract.revokeIdentity(targetWallet.trim());
      await tx.wait();

      setStatusMessage("Identity status updated to REVOKED.");
      saveLog({
        action: "Revoke Identity",
        wallet: targetWallet.trim(),
        status: "Revoked",
        txHash: tx.hash,
      });
      await checkVisitorStatus(targetWallet.trim());
    } catch (error) {
      setStatusMessage(`Revoke failed: ${getErrorMessage(error)}`);
    } finally {
      setIsRevoking(false);
    }
  }

  // ✅ ĐÃ THÊM: Hàm bác bỏ đơn khiếu nại (Keep Revoked) và lưu log hệ thống công khai
  const handleRejectAppeal = () => {
    if (!targetWallet.trim()) return;
    try {
      // Ghi log từ chối khiếu nại vào Audit Trail tổng
      saveLog({
        action: "Appeal Rejected / Keep Revoked",
        wallet: targetWallet.trim(),
        status: "Revoked",
        txHash: "compliance-lock",
      });

      // Xóa đơn khiếu nại vì Admin đã đưa ra phán quyết giữ nguyên lệnh cấm
      const appealsRaw = window.localStorage.getItem(APPEALS_KEY);
      if (appealsRaw) {
        const parsedAppeals = JSON.parse(appealsRaw) as AppealTicket[];
        const updated = parsedAppeals.filter(a => a.wallet.toLowerCase() !== targetWallet.trim().toLowerCase());
        window.localStorage.setItem(APPEALS_KEY, JSON.stringify(updated));
      }
      setActiveAppeal(null);
      setStatusMessage("🚫 Appeal statement rejected. Cryptographic profile parameters remain locked.");
    } catch (e) {
      console.error(e);
    }
  };

  function handleUseVisitorWallet() {
    if (!visitorWallet.trim()) {
      setStatusMessage("Enter visitor wallet first.");
      return;
    }

    setTargetWallet(visitorWallet.trim());
    setCurrentOnChainStatus("None");
    setLookupHash("");
    setActiveAppeal(null);
    setStatusMessage("Visitor wallet copied to lookup desk.");
  }

  function handleClearForm() {
    setVisitorName("");
    setPhone("");
    setEmail("");
    setVisitorWallet("");
    setGeneratedHash("");
    setStatusMessage("Register form cleared.");
  }

  function handleLogout() {
    window.localStorage.removeItem("lotte_web2_user");
    window.location.href = "/";
  }

  if (isCheckingRole) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff8f6] text-[#151515]">
        <div className="rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-xl shadow-red-50">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">
            Checking session
          </p>
          <h1 className="mt-3 text-3xl font-black">Loading Admin Portal...</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fff8f6] text-[#151515]">
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-[#fff4f1] to-[#ffe1dc] pb-12">
        <div className="pointer-events-none absolute left-[-180px] top-[-180px] h-[460px] w-[460px] rounded-full bg-[#E30613]/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-240px] right-[-120px] h-[520px] w-[520px] rounded-full bg-[#E30613]/20 blur-3xl" />
        <div className="pointer-events-none absolute right-[12%] top-24 hidden h-40 w-40 rotate-12 rounded-[3rem] bg-[#E30613]/10 lg:block" />

        <div className="relative mx-auto max-w-7xl px-6 py-7">
          <nav className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <Link href="/" className="group flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-[#E30613] text-3xl font-black text-white shadow-xl shadow-red-200">
                L
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-[#E30613]">
                  Lotte Mall West Lake
                </p>
                <h1 className="text-xl font-black tracking-tight md:text-2xl">
                  Lotte Mall Admin Portal
                </h1>
              </div>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/transactions"
                className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-[#E30613] hover:text-[#E30613]"
              >
                Audit Log
              </Link>

              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="rounded-full bg-[#E30613] px-5 py-3 text-sm font-black text-white shadow-xl shadow-red-200 transition hover:-translate-y-0.5 hover:bg-[#bd000a] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isConnecting
                  ? "Connecting..."
                  : walletAddress
                    ? shortenAddress(walletAddress)
                    : "Connect Admin Wallet"}
              </button>

              <button
                onClick={handleLogout}
                className="rounded-full border border-neutral-200 bg-neutral-100 px-5 py-3 text-sm font-black text-neutral-500 shadow-sm transition hover:bg-neutral-200 hover:text-neutral-800"
              >
                Logout
              </button>
            </div>
          </nav>

          <div className="mt-14 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-red-100 bg-white/85 px-5 py-3 text-sm font-black text-[#E30613] shadow-sm backdrop-blur">
                <span className="h-3 w-3 rounded-full bg-[#E30613]" />
                Lotte Mall Admin
              </div>

              <h2 className="mt-6 max-w-5xl text-5xl font-black leading-[0.98] tracking-[-0.055em] text-[#111] md:text-7xl">
                Register and manage <span className="text-[#E30613]">visitor identity.</span>
              </h2>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-700">
                This portal is used by Lotte Mall Admin to register visitor identity,
                approve verification status, look up records, and revoke access when needed.
              </p>
            </div>

            <div className="rounded-[2rem] border border-red-100 bg-white/85 p-5 shadow-xl shadow-red-50 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-neutral-400">
                Admin System Message
              </p>
              <p
                className={`mt-3 break-words text-base font-black leading-7 ${
                  statusMessage.toLowerCase().includes("failed") ||
                  statusMessage.toLowerCase().includes("invalid") ||
                  statusMessage.toLowerCase().includes("not installed") ||
                  statusMessage.toLowerCase().includes("does not expose") ||
                  statusMessage.toLowerCase().includes("flagged")
                    ? "text-red-600"
                    : "text-green-700"
                }`}
              >
                {statusMessage}
              </p>

              <div className="mt-4 rounded-2xl bg-[#fff4f1] p-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#E30613]">
                  Connected Wallet
                </p>
                <p className="mt-2 break-all text-sm font-black text-neutral-900">
                  {walletAddress || "Not connected"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2.5rem] border border-red-100 bg-white p-7 shadow-xl shadow-red-50 md:p-8">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">
              Register Identity
            </p>
            <h3 className="mt-2 text-4xl font-black tracking-tight">
              Visitor Information
            </h3>

            <p className="mt-4 max-w-2xl leading-7 text-neutral-600">
              Raw visitor details are used only to generate an identity hash.
              The blockchain stores the hash and status, not private data.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <Field
                label="Visitor Name"
                value={visitorName}
                onChange={setVisitorName}
                placeholder="Nguyen Tung Lam"
              />

              <Field
                label="Phone Number"
                value={phone}
                onChange={setPhone}
                placeholder="0912345678"
              />

              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                placeholder="visitor@example.com"
              />

              <Field
                label="Visitor Wallet Address (DID Owner)"
                value={visitorWallet}
                onChange={(value) => {
                  setVisitorWallet(value);
                  setGeneratedHash("");
                }}
                placeholder="0x..."
                mono
              />
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-red-100 bg-[#fffaf8] p-5">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-400">
                DID Preview
              </p>
              <p className="mt-2 break-all text-sm font-black text-neutral-900">
                {didPreview}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-4">
              <button
                onClick={handleGenerateHash}
                disabled={isGenerating}
                className="rounded-2xl border border-red-200 bg-white px-6 py-4 font-black text-[#E30613] transition hover:-translate-y-0.5 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isGenerating ? "Generating..." : "Generate Identity Hash"}
              </button>

              <button
                onClick={handleRegisterIdentity}
                disabled={!canRegister || isRegistering}
                className="rounded-2xl bg-[#E30613] px-6 py-4 font-black text-white shadow-xl shadow-red-200 transition hover:-translate-y-0.5 hover:bg-[#bd000a] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isRegistering ? "Registering..." : "Register Identity On-chain"}
              </button>

              <button
                onClick={handleUseVisitorWallet}
                className="rounded-2xl border border-neutral-200 bg-neutral-50 px-6 py-4 font-black text-neutral-700 transition hover:-translate-y-0.5 hover:bg-neutral-100"
              >
                Use in Lookup
              </button>

              <button
                onClick={handleClearForm}
                className="rounded-2xl border border-neutral-200 bg-white px-6 py-4 font-black text-neutral-500 transition hover:-translate-y-0.5 hover:bg-neutral-50"
              >
                Clear
              </button>
            </div>

            {generatedHash ? (
              <div className="mt-6 rounded-[1.7rem] bg-neutral-950 p-5 text-white shadow-xl shadow-neutral-200">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-white/45">
                  Generated Identity Hash
                </p>
                <p className="mt-3 break-all font-mono text-sm font-bold text-white">
                  {generatedHash}
                </p>
              </div>
            ) : null}
          </div>

          {/* KHU VỰC DESK TRA CỨU: Tích hợp nội dung đơn khiếu nại của Visitor vào thẳng Lookup Result */}
          <div className="rounded-[2.5rem] border border-red-100 bg-white p-7 shadow-xl shadow-red-50 md:p-8">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">
              Identity Management Desk
            </p>
            <h3 className="mt-2 text-4xl font-black tracking-tight">
              Visitor Status Lookup
            </h3>

            <p className="mt-4 leading-7 text-neutral-600">
              Admin checks a visitor wallet to manage identity status. Merchant access
              checking is handled separately in the Merchant Verify Page.
            </p>

            <div className="mt-8">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">
                Target Visitor Wallet Address
              </label>

              <div className="mt-2 flex flex-col gap-3 md:flex-row">
                <input
                  type="text"
                  placeholder="0x..."
                  value={targetWallet}
                  onChange={(event) => {
                    setTargetWallet(event.target.value);
                    setCurrentOnChainStatus("None");
                    setLookupHash("");
                    setActiveAppeal(null);
                  }}
                  className="min-w-0 flex-1 rounded-2xl border border-neutral-200 bg-[#fffaf8] px-5 py-4 font-mono text-sm font-bold outline-none transition placeholder:text-neutral-400 focus:border-[#E30613] focus:bg-white focus:ring-4 focus:ring-red-50"
                />

                <button
                  onClick={() => void checkVisitorStatus()}
                  disabled={isSearching}
                  className="rounded-2xl bg-[#E30613] px-6 py-4 font-black text-white shadow-xl shadow-red-100 transition hover:-translate-y-0.5 hover:bg-[#bd000a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSearching ? "Searching..." : "Look up"}
                </button>
              </div>
            </div>

            <div className="mt-6 rounded-[1.7rem] border border-neutral-100 bg-[#fffaf8] p-5">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-400">
                Lookup Result
              </p>

              <div className="mt-4 grid gap-4">
                <ResultRow label="Status" value={currentOnChainStatus} strong />
                <ResultRow
                  label="Target DID"
                  value={targetWallet ? makeDid(targetWallet) : "Waiting for lookup"}
                />
                <ResultRow
                  label="Identity Hash"
                  value={lookupHash || "No hash loaded"}
                />

                {/* ✅ ĐÃ THÊM: Hiển thị Statement khiếu nại ngay trong hộp tra cứu nếu tìm thấy đơn khớp địa chỉ ví */}
                {activeAppeal && (
                  <div className="mt-2 rounded-2xl border border-dashed border-red-200 bg-red-50/30 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-red-600">
                      ⚠️ Active Appeal Reason Statement
                    </p>
                    <p className="mt-2 text-sm font-bold text-neutral-800 bg-white px-3 py-2 rounded-xl border border-neutral-100">
                      "{activeAppeal.reason}"
                    </p>
                    <p className="mt-1.5 text-[10px] font-bold text-neutral-400 text-right">
                      Transmitted: {activeAppeal.time}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 border-t border-neutral-100 pt-6">
              <p className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-neutral-400">
                Management Action
              </p>

              {currentOnChainStatus === "None" ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-center text-sm font-black text-neutral-400">
                  Perform a lookup to see available actions.
                </div>
              ) : null}

              {currentOnChainStatus === "Pending" && (
                <button
                  onClick={handleApproveIdentity}
                  disabled={isApproving}
                  className="w-full rounded-2xl bg-green-600 py-4 font-black text-white shadow-xl shadow-green-100 transition hover:-translate-y-0.5 hover:bg-green-700"
                >
                  {isApproving ? "Approving..." : "Approve Visitor Identity"}
                </button>
              )}

              {currentOnChainStatus === "Verified" && (
                <button
                  onClick={handleRevokeIdentity}
                  disabled={isRevoking}
                  className="w-full rounded-2xl bg-neutral-950 py-4 font-black text-white shadow-xl shadow-red-50 transition hover:-translate-y-0.5 hover:bg-[#E30613]"
                >
                  {isRevoking ? "Revoking..." : "Revoke Identity"}
                </button>
              )}

              {/* ✅ ĐÃ SỬA: Luồng quyết định kép (Restore hoặc Keep Revoked) khi xem xét tài khoản bị khiếu nại cấm sóng */}
              {currentOnChainStatus === "Revoked" && (
                <div className="grid gap-3">
                  <button
                    onClick={handleApproveIdentity}
                    disabled={isApproving}
                    className="w-full rounded-2xl bg-blue-600 py-4 font-black text-white shadow-xl shadow-blue-100 transition hover:-translate-y-0.5 hover:bg-blue-700"
                  >
                    {isApproving ? "Restoring..." : "Restore Visitor Identity"}
                  </button>
                  
                  {activeAppeal && (
                    <button
                      onClick={handleRejectAppeal}
                      className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 py-3 text-sm font-black text-neutral-500 transition hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                    >
                      Keep Account Revoked
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-14">
        <div className="grid gap-5 rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-xl shadow-red-50 md:grid-cols-3">
          <StepCard
            number="01"
            title="Generate Hash"
            description="Admin converts private visitor data into an identity hash."
          />
          <StepCard
            number="02"
            title="Register On-chain"
            description="Only hash, wallet, and status are stored on the smart contract."
          />
          <StepCard
            number="03"
            title="Lookup / Revoke"
            description="Admin can check status and revoke access when required."
          />
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`mt-2 w-full rounded-2xl border border-neutral-200 bg-[#fffaf8] px-5 py-4 text-sm font-bold text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[#E30613] focus:bg-white focus:ring-4 focus:ring-red-50 ${
          mono ? "font-mono" : ""
        }`}
      />
    </div>
  );
}

function ResultRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-400">
        {label}
      </p>
      <p
        className={`mt-1 break-all ${
          strong
            ? "text-3xl font-black text-[#E30613]"
            : "text-sm font-black text-neutral-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[2rem] bg-[#fff4f1] p-6">
      <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">
        {number}
      </p>
      <h3 className="mt-4 text-2xl font-black">{title}</h3>
      <p className="mt-3 leading-7 text-neutral-600">{description}</p>
    </div>
  );
}