"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import contractABI from "../constants/contractABI.json";

type IdentityStatus = "None" | "Pending" | "Verified" | "Revoked";
type EthereumRequestArgs = { method: string; params?: unknown[]; };
type EthereumProvider = { request: <T = unknown>(args: EthereumRequestArgs) => Promise<T>; };
type UserSession = { role?: "visitor" | "admin" | "merchant"; name?: string; email?: string; };
type IdentityContract = {
  getIdentity: (walletAddress: string) => Promise<unknown>;
  registerIdentity?: (walletAddress: string, identityHash: string) => Promise<ContractTransaction>;
  verifyIdentity?: (walletAddress: string) => Promise<ContractTransaction>;
  revokeIdentity?: (walletAddress: string) => Promise<ContractTransaction>;
};
type ContractTransaction = { hash: string; wait: () => Promise<unknown>; };
type IdentityLookupResult = { hash: string; status: IdentityStatus; verified: boolean; revoked: boolean; };
type TransactionLog = { id: string; action: string; wallet: string; status: string; txHash: string; time: string; };
type AppealTicket = { id: string; wallet: string; name: string; reason: string; time: string; };

declare global { interface Window { ethereum?: EthereumProvider; } }

const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const STORAGE_KEY = "lotte_transaction_logs";
const APPEALS_KEY = "lotte_admin_appeals";

function shortenAddress(address: string) { return !address ? "Not connected" : `${address.slice(0, 6)}...${address.slice(-4)}`; }
function makeDid(address: string) { return !address ? "did:lotte:not-connected" : `did:lotte:${address}`; }
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
  try { return (JSON.parse(value) as UserSession).role === "admin"; } catch { return false; }
}
function parseIdentityResult(data: unknown): IdentityLookupResult {
  if (!data || !Array.isArray(data) || data[0] === undefined) return { hash: "", verified: false, revoked: false, status: "None" };
  const hash = data[0] ? String(data[0]).trim() : "";
  const verified = Boolean(data[3]);
  const revoked = Boolean(data[4]);
  let status: IdentityStatus = "None";
  if (!hash || hash === "0x" || hash === "0x0000000000000000000000000000000000000000000000000000000000000000") status = "None";
  else if (revoked) status = "Revoked";
  else if (verified) status = "Verified";
  else status = "Pending";
  return { hash, verified, revoked, status };
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
      return typeof log.action === "string" && typeof log.status === "string" && typeof log.txHash === "string" && typeof log.time === "string";
    });
  } catch { return []; }
}
function saveLog(log: Omit<TransactionLog, "id" | "time">) {
  const nextLog: TransactionLog = { ...log, id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, time: new Date().toLocaleTimeString() };
  const currentLogs = readLogs();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([nextLog, ...currentLogs].slice(0, 20)));
}

export default function AdminPortal() {
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const [walletAddress, setWalletAddress] = useState("");
  const [statusMessage, setStatusMessage] = useState("Sign in as Lotte Mall Admin and connect MetaMask.");
  const [contract, setContract] = useState<IdentityContract | null>(null);
  const [visitorName, setVisitorName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [visitorWallet, setVisitorWallet] = useState("");
  const [generatedHash, setGeneratedHash] = useState("");
  const [targetWallet, setTargetWallet] = useState("");
  const [lookupHash, setLookupHash] = useState("");
  const [currentOnChainStatus, setCurrentOnChainStatus] = useState<IdentityStatus>("None");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [activeAppeal, setActiveAppeal] = useState<AppealTicket | null>(null);

  const didPreview = useMemo(() => makeDid(visitorWallet), [visitorWallet]);
  const canRegister = Boolean(contract) && ethers.isAddress(visitorWallet.trim()) && Boolean(generatedHash);

  useEffect(() => {
    const isAdmin = isValidSession(window.localStorage.getItem("lotte_web2_user"));
    if (!isAdmin) { window.location.href = "/"; return; }
    setIsCheckingRole(false);
    const savedWallet = window.localStorage.getItem("lotte_wallet_address");
    if (savedWallet) setWalletAddress(savedWallet);
  }, []);

  async function connectWallet() {
    try {
      setIsConnecting(true);
      if (!window.ethereum) { setStatusMessage("MetaMask is not installed."); return; }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const selectedAccount = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : await signer.getAddress();
      const deployedContract = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, signer) as unknown as IdentityContract;
      setWalletAddress(selectedAccount);
      setContract(deployedContract);
      window.localStorage.setItem("lotte_wallet_address", selectedAccount);
      setStatusMessage("Admin wallet connected successfully.");
    } catch (error) { setStatusMessage(`Wallet connection failed: ${getErrorMessage(error)}`); } finally { setIsConnecting(false); }
  }

  function handleGenerateHash() {
    if (!visitorName.trim() || !phone.trim() || !email.trim()) { setStatusMessage("Please fill in visitor name, phone, and email."); return; }
    if (!visitorWallet.trim() || !ethers.isAddress(visitorWallet.trim())) { setStatusMessage("Please enter a valid visitor wallet address."); return; }
    setIsGenerating(true);
    const rawData = JSON.stringify({ name: visitorName.trim(), phone: phone.trim(), email: email.trim().toLowerCase(), wallet: visitorWallet.trim().toLowerCase() });
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
    if (!contract || !contract.registerIdentity) { setStatusMessage("Please connect Admin wallet first."); return; }
    if (!canRegister) { setStatusMessage("Generate a valid identity hash before registering."); return; }
    try {
      setIsRegistering(true);
      setStatusMessage("Sending Register Identity transaction to blockchain...");
      const tx = await contract.registerIdentity(visitorWallet.trim(), generatedHash);
      await tx.wait();
      saveLog({ action: "Register Identity", wallet: visitorWallet.trim(), status: "Success", txHash: tx.hash });
      setStatusMessage("Identity registered on blockchain successfully.");
      setTargetWallet(visitorWallet.trim());
      await checkVisitorStatus(visitorWallet.trim());
    } catch (error) { setStatusMessage(`Register failed: ${getErrorMessage(error)}`); } finally { setIsRegistering(false); }
  }

  async function checkVisitorStatus(walletFromAction?: string) {
    const walletToCheck = walletFromAction ?? targetWallet.trim();
    if (!contract) { setStatusMessage("Please connect Admin wallet first."); return; }
    if (!walletToCheck || !ethers.isAddress(walletToCheck)) { setStatusMessage("Please enter a valid visitor wallet address."); return; }
    try {
      setIsSearching(true);
      setStatusMessage("Fetching visitor status from smart contract...");
      const data = await contract.getIdentity(walletToCheck);
      const parsed = parseIdentityResult(data);
      setTargetWallet(walletToCheck);
      setLookupHash(parsed.hash);
      setCurrentOnChainStatus(parsed.status);

      const appealsRaw = window.localStorage.getItem(APPEALS_KEY);
      if (appealsRaw) {
        const parsedAppeals = JSON.parse(appealsRaw) as AppealTicket[];
        const found = parsedAppeals.find(a => a.wallet.toLowerCase() === walletToCheck.toLowerCase());
        setActiveAppeal(found || null);
      } else { setActiveAppeal(null); }

      if (parsed.status === "None") setStatusMessage("No registered identity found for this wallet.");
      else if (parsed.status === "Pending") setStatusMessage("Identity found. Current status: Pending approval.");
      else if (parsed.status === "Verified") setStatusMessage("Identity found. Current status: Verified.");
      else if (parsed.status === "Revoked") setStatusMessage("Identity found. Current status: Revoked.");

      saveLog({ action: "Look up Visitor", wallet: walletToCheck, status: parsed.status, txHash: "read-only" });
    } catch (error) { setStatusMessage(`Lookup failed: ${getErrorMessage(error)}`); } finally { setIsSearching(false); }
  }

  async function handleApproveIdentity() {
    if (!contract || !contract.verifyIdentity) { setStatusMessage("Please connect Admin wallet first."); return; }
    if (!targetWallet.trim() || !ethers.isAddress(targetWallet.trim())) { setStatusMessage("Please enter a valid visitor wallet address."); return; }
    try {
      setIsApproving(true);
      setStatusMessage("Sending Approve Identity transaction to blockchain...");
      const tx = await contract.verifyIdentity(targetWallet.trim());
      await tx.wait();
      setStatusMessage("Identity approved successfully.");
      saveLog({ action: currentOnChainStatus === "Revoked" ? "Appeal Approved / Restore" : "Approve Identity", wallet: targetWallet.trim(), status: "Verified", txHash: tx.hash });
      const appealsRaw = window.localStorage.getItem(APPEALS_KEY);
      if (appealsRaw) {
        const parsedAppeals = JSON.parse(appealsRaw) as AppealTicket[];
        const updated = parsedAppeals.filter(a => a.wallet.toLowerCase() !== targetWallet.trim().toLowerCase());
        window.localStorage.setItem(APPEALS_KEY, JSON.stringify(updated));
      }
      setActiveAppeal(null);
      await checkVisitorStatus(targetWallet.trim());
    } catch (error) { setStatusMessage(`Approve failed: ${getErrorMessage(error)}`); } finally { setIsApproving(false); }
  }

  async function handleRevokeIdentity() {
    if (!contract || !contract.revokeIdentity) { setStatusMessage("Please connect Admin wallet first."); return; }
    if (!targetWallet.trim() || !ethers.isAddress(targetWallet.trim())) { setStatusMessage("Please enter a valid visitor wallet address."); return; }
    try {
      setIsRevoking(true);
      setStatusMessage("Sending Revoke Identity transaction to blockchain...");
      const tx = await contract.revokeIdentity(targetWallet.trim());
      await tx.wait();
      setStatusMessage("Identity status updated to REVOKED.");
      saveLog({ action: "Revoke Identity", wallet: targetWallet.trim(), status: "Revoked", txHash: tx.hash });
      await checkVisitorStatus(targetWallet.trim());
    } catch (error) { setStatusMessage(`Revoke failed: ${getErrorMessage(error)}`); } finally { setIsRevoking(false); }
  }

  const handleRejectAppeal = () => {
    if (!targetWallet.trim()) return;
    try {
      saveLog({ action: "Appeal Rejected / Keep Revoked", wallet: targetWallet.trim(), status: "Revoked", txHash: "compliance-lock" });
      const appealsRaw = window.localStorage.getItem(APPEALS_KEY);
      if (appealsRaw) {
        const parsedAppeals = JSON.parse(appealsRaw) as AppealTicket[];
        const updated = parsedAppeals.filter(a => a.wallet.toLowerCase() !== targetWallet.trim().toLowerCase());
        window.localStorage.setItem(APPEALS_KEY, JSON.stringify(updated));
      }
      setActiveAppeal(null);
      setStatusMessage("🚫 Appeal statement rejected. Cryptographic profile parameters remain locked.");
    } catch (e) { console.error(e); }
  };

  function handleUseVisitorWallet() {
    if (!visitorWallet.trim()) { setStatusMessage("Enter visitor wallet first."); return; }
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

  if (isCheckingRole) return null;

  return (
    <main className="min-h-screen text-[#151515] relative overflow-hidden" style={{ background: "radial-gradient(circle at 0% 0%, rgba(227, 6, 19, 0.14), transparent 32%), radial-gradient(circle at 95% 100%, rgba(227, 6, 19, 0.22), transparent 34%), linear-gradient(135deg, #fff8f6 0%, #fffdfc 48%, #fff0ee 100%)" }}>
      <div className="pointer-events-none absolute -left-44 -top-44 z-0 h-[460px] w-[460px] rounded-full bg-[#E30613]/15 blur-3xl"></div>
      <div className="pointer-events-none absolute -bottom-48 -right-40 z-0 h-[560px] w-[560px] rounded-full bg-[#E30613]/20 blur-3xl"></div>
      <div className="pointer-events-none absolute right-[8%] top-28 z-0 hidden h-44 w-44 rotate-12 rounded-[3.5rem] bg-[#E30613]/10 lg:block"></div>

      <section className="relative z-10 mx-auto max-w-[1180px] px-8 py-10">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[1.3rem] bg-white shadow-xl shadow-red-100">
              <img src="/lotte%20mall.png" alt="Lotte Mall" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.42em] text-[#E30613]">Lotte Mall West Lake</p>
              <h1 className="text-2xl font-black tracking-tight">Lotte Mall Admin Portal</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/transactions" className="rounded-full border border-red-100 bg-white/90 px-5 py-3 text-sm font-black shadow-sm">Audit Log</Link>
            <button onClick={connectWallet} disabled={isConnecting} className="rounded-full bg-[#E30613] px-5 py-3 text-sm font-black text-white shadow-xl shadow-red-200">
              {walletAddress ? `Admin · ${shortenAddress(walletAddress)}` : isConnecting ? "Connecting..." : "Connect Admin Wallet"}
            </button>
            <button onClick={handleLogout} className="rounded-full border border-neutral-200 bg-neutral-100 px-5 py-3 text-sm font-black text-neutral-500 shadow-sm">Logout</button>
          </div>
        </header>

        {/* Hero */}
        <section className="mb-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-red-100 bg-white/85 px-5 py-3 text-sm font-black text-[#E30613] shadow-sm">
              <span className="h-3 w-3 rounded-full bg-[#E30613]"></span>Lotte Mall Admin
            </div>
            <h2 className="max-w-[600px] text-6xl font-black leading-[0.92] tracking-[-0.07em]">
              Review and approve <span className="text-[#E30613]">visitor identity.</span>
            </h2>
            <p className="mt-6 max-w-[520px] text-lg font-semibold leading-8 text-neutral-600">
              Admin reviews the submitted DID request, proof reference, and event access purpose before updating identity status.
            </p>
          </div>
          <div className="rounded-[2.5rem] border border-red-100 bg-white/90 p-7 shadow-2xl shadow-red-100">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-400">Admin System Message</p>
            <p className={`mt-3 text-base font-black ${statusMessage.toLowerCase().includes("failed") || statusMessage.toLowerCase().includes("invalid") ? "text-red-600" : "text-green-700"}`}>
              {statusMessage}
            </p>
            <div className="mt-5 rounded-[1.7rem] bg-[#fff4f1] p-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#E30613]">Connected Admin Wallet</p>
              <p className="mt-2 break-all font-mono text-sm font-black">{walletAddress || "Not connected"}</p>
            </div>
          </div>
        </section>

        {/* Form Registration (Kept from logic) */}
        <section className="mb-8 rounded-[2.7rem] border border-red-100 bg-white/92 p-7 shadow-sm">
           <p className="text-sm font-black uppercase tracking-[0.32em] text-[#E30613]">Register Identity</p>
           <h2 className="mt-3 text-4xl font-black tracking-tight">Visitor Information Setup</h2>
           <div className="mt-7 grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-neutral-400">Visitor Name</p>
                <input value={visitorName} onChange={e => setVisitorName(e.target.value)} className="w-full rounded-2xl border border-red-100 bg-[#fffaf8] px-5 py-4 text-sm font-black outline-none" />
              </div>
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-neutral-400">Phone</p>
                <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full rounded-2xl border border-red-100 bg-[#fffaf8] px-5 py-4 text-sm font-black outline-none" />
              </div>
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-neutral-400">Email</p>
                <input value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-2xl border border-red-100 bg-[#fffaf8] px-5 py-4 text-sm font-black outline-none" />
              </div>
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-neutral-400">Visitor Wallet</p>
                <input value={visitorWallet} onChange={e => {setVisitorWallet(e.target.value); setGeneratedHash("");}} className="w-full rounded-2xl border border-red-100 bg-[#fffaf8] px-5 py-4 text-sm font-black outline-none font-mono" />
              </div>
           </div>
           <div className="mt-6 flex flex-wrap gap-4">
              <button onClick={handleGenerateHash} disabled={isGenerating} className="rounded-2xl border border-red-100 bg-white px-5 py-4 text-sm font-black text-[#E30613] shadow-sm">
                {isGenerating ? "Generating..." : "Generate Hash"}
              </button>
              <button onClick={handleRegisterIdentity} disabled={!canRegister || isRegistering} className="rounded-2xl bg-[#E30613] px-5 py-4 text-sm font-black text-white shadow-xl shadow-red-200">
                {isRegistering ? "Registering..." : "Register On-chain"}
              </button>
              <button onClick={handleUseVisitorWallet} className="rounded-2xl border border-neutral-200 bg-neutral-100 px-5 py-4 text-sm font-black text-neutral-500 shadow-sm">Use in Lookup</button>
              <button onClick={handleClearForm} className="rounded-2xl border border-neutral-200 bg-neutral-100 px-5 py-4 text-sm font-black text-neutral-500 shadow-sm">Clear</button>
           </div>
           {generatedHash && (
             <div className="mt-5 rounded-[1.7rem] bg-[#fff4f1] p-5">
               <p className="text-xs font-black uppercase tracking-[0.22em] text-[#E30613]">Generated Hash</p>
               <p className="mt-2 break-all font-mono text-sm font-black">{generatedHash}</p>
             </div>
           )}
        </section>

        {/* Main Review Area */}
        <section className="grid gap-7 pb-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2.7rem] border border-red-100 bg-white/92 p-7 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.32em] text-[#E30613]">Visitor Identity Detail</p>
                <h2 className="mt-3 text-4xl font-black tracking-tight">Lookup Details.</h2>
              </div>
              <span className={`rounded-full px-5 py-3 text-sm font-black ${currentOnChainStatus === 'Verified' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {currentOnChainStatus}
              </span>
            </div>
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-neutral-100 bg-[#fffaf8] p-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-400">Target DID</p>
                <p className="mt-2 font-mono text-xs font-black break-all">{targetWallet ? makeDid(targetWallet) : "Waiting for lookup"}</p>
              </div>
              <div className="rounded-2xl border border-neutral-100 bg-[#fffaf8] p-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-400">Wallet</p>
                <p className="mt-2 font-mono text-xs font-black break-all">{targetWallet || "Not loaded"}</p>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-neutral-100 bg-[#fffaf8] p-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-400">Identity Hash</p>
                <p className="mt-2 break-all font-mono text-sm font-black">{lookupHash || "No hash loaded"}</p>
              </div>
              {activeAppeal && (
                <div className="rounded-[1.7rem] border border-dashed border-red-200 bg-red-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-red-600">⚠️ Active Appeal Reason Statement</p>
                  <p className="mt-2 text-sm font-bold text-neutral-800 bg-white px-3 py-2 rounded-xl border border-neutral-100">"{activeAppeal.reason}"</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2.7rem] border border-red-100 bg-white/92 p-7 shadow-sm">
            <p className="text-sm font-black uppercase tracking-[0.32em] text-[#E30613]">Verification Status</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight">Status lookup.</h2>
            <div className="mt-7 grid gap-3 md:grid-cols-[1fr_auto]">
              <input value={targetWallet} onChange={(e) => {setTargetWallet(e.target.value); setCurrentOnChainStatus("None"); setLookupHash(""); setActiveAppeal(null);}} placeholder="0x..." className="rounded-2xl border border-red-100 bg-[#fffaf8] px-5 py-4 font-mono text-sm font-black outline-none" />
              <button onClick={() => checkVisitorStatus()} disabled={isSearching} className="rounded-2xl bg-[#E30613] px-7 py-4 text-sm font-black text-white shadow-xl shadow-red-200">Look up</button>
            </div>
            <div className="mt-7 rounded-[2rem] border border-red-50 bg-[#fffaf8] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-400">Current Status</p>
                  <p className="mt-2 text-4xl font-black text-yellow-700">{currentOnChainStatus}</p>
                </div>
              </div>
            </div>
            <div className="mt-7 rounded-[2rem] border border-red-100 bg-white p-6">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-400">Admin Decision</p>
              
              {currentOnChainStatus === "Pending" && (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <button onClick={handleApproveIdentity} disabled={isApproving} className="rounded-2xl bg-green-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-green-100">Approve Identity</button>
                  <button onClick={handleRevokeIdentity} disabled={isRevoking} className="rounded-2xl bg-[#E30613] px-5 py-4 text-sm font-black text-white shadow-xl shadow-red-200">Reject Request</button>
                </div>
              )}
              {currentOnChainStatus === "Verified" && (
                <button onClick={handleRevokeIdentity} disabled={isRevoking} className="mt-5 w-full rounded-2xl bg-neutral-900 px-5 py-4 text-sm font-black text-white">Revoke Identity</button>
              )}
              {currentOnChainStatus === "Revoked" && (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <button onClick={handleApproveIdentity} disabled={isApproving} className="rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-lg">Restore Identity</button>
                  {activeAppeal && <button onClick={handleRejectAppeal} className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-black text-red-600">Keep Revoked</button>}
                </div>
              )}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}