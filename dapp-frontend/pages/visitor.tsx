"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ethers } from "ethers";
import CryptoJS from "crypto-js";
import contractABI from "../constants/contractABI.json";

type EthereumRequestArgs = { method: string; params?: unknown[]; };
type EthereumProvider = { request: <T = unknown>(args: EthereumRequestArgs) => Promise<T>; };

declare global { interface Window { ethereum?: EthereumProvider; } }

type UserRole = "visitor" | "admin" | "merchant";
type UserSession = { role: UserRole; name: string; email: string; phone?: string; signedInAt: string; };
type IdentityStatus = "Not Registered" | "Pending" | "Verified" | "Revoked";
type IdentityResultLike = { 0?: unknown; 1?: unknown; 2?: unknown; 3?: unknown; 4?: unknown; };
type AuditLog = { id: string; action: string; walletOrDid: string; status: string; txHash: string; time: string; };

const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const TX_LOG_KEY = "lotte_transaction_logs";
const APPEALS_KEY = "lotte_admin_appeals";
const PARKING_REQ_KEY = "lotte_parking_requests";
const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT ?? "";

function makeDid(address: string) { return !address ? "did:lotte:not-connected" : `did:lotte:${address}`; }
function createDemoTxHash(seed: string) {
  const cleanSeed = seed.toLowerCase().replace(/[^a-f0-9]/g, "");
  const repeatedSeed = `${cleanSeed}${cleanSeed}${cleanSeed}${cleanSeed}`;
  return `0x${repeatedSeed.slice(0, 64).padEnd(64, "0")}`;
}
function getErrorMessage(error: unknown) { return error instanceof Error ? error.message : "Unknown error"; }
function safeParseSession(value: string | null): UserSession | null {
  if (!value) return null;
  try { const parsed = JSON.parse(value) as Partial<UserSession>; return parsed.role === "visitor" ? { role: "visitor", name: typeof parsed.name === "string" ? parsed.name : "Visitor", email: typeof parsed.email === "string" ? parsed.email : "", phone: typeof parsed.phone === "string" ? parsed.phone : undefined, signedInAt: typeof parsed.signedInAt === "string" ? parsed.signedInAt : new Date().toISOString() } : null; } catch { return null; }
}
function appendAuditLog(log: AuditLog) {
  const rawLogs = window.localStorage.getItem(TX_LOG_KEY);
  try {
    const parsedLogs = rawLogs ? (JSON.parse(rawLogs) as unknown) : [];
    const currentLogs = Array.isArray(parsedLogs) ? parsedLogs : [];
    window.localStorage.setItem(TX_LOG_KEY, JSON.stringify([log, ...currentLogs]));
  } catch { window.localStorage.setItem(TX_LOG_KEY, JSON.stringify([log])); }
}

export default function VisitorWalletPage() {
  const router = useRouter();
  const [web2User, setWeb2User] = useState<UserSession | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [statusMessage, setStatusMessage] = useState("Connect MetaMask to create your visitor DID.");
  const [onChainStatus, setOnChainStatus] = useState<IdentityStatus>("Not Registered");
  const [onChainHash, setOnChainHash] = useState("");
  const [onChainCid, setOnChainCid] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ipfsCID, setIpfsCID] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [appealReason, setAppealReason] = useState("");
  const [isAppealSubmitted, setIsAppealSubmitted] = useState(false);
  const [parkingReqStatus, setParkingReqStatus] = useState<"idle" | "sent" | "approved" | "rejected">("idle");
  const [verificationPin, setVerificationPin] = useState("");
  const [activeTab, setActiveTab] = useState<"wallet" | "pin">("wallet");

  const did = useMemo(() => makeDid(walletAddress), [walletAddress]);
  const identityHashPreview = useMemo(() => {
    if (!web2User || !walletAddress) return "Not generated yet";
    const rawData = [visitorName.trim(), visitorPhone.trim(), web2User.email.trim(), walletAddress.toLowerCase()].join("|");
    return `0x${CryptoJS.SHA256(rawData).toString()}`;
  }, [visitorName, visitorPhone, web2User, walletAddress]);

  useEffect(() => {
    const session = safeParseSession(window.localStorage.getItem("lotte_web2_user"));
    if (!session) { router.push("/"); return; }
    setWeb2User(session);
    setVisitorName(session.name);
    setVisitorPhone(session.phone ?? "");
    const savedWallet = window.localStorage.getItem("lotte_wallet_address");
    if (savedWallet) { setWalletAddress(savedWallet); fetchOnChainIdentity(savedWallet); }
  }, [router]);

  useEffect(() => {
    if (walletAddress) {
      try {
        const existingAppealsRaw = window.localStorage.getItem(APPEALS_KEY);
        if (existingAppealsRaw) setIsAppealSubmitted(JSON.parse(existingAppealsRaw).some((a: any) => a.wallet.toLowerCase() === walletAddress.toLowerCase()));
        const currentReqs = JSON.parse(window.localStorage.getItem(PARKING_REQ_KEY) || "[]");
        const foundReq = currentReqs.find((r: any) => r.wallet.toLowerCase() === walletAddress.toLowerCase());
        if (foundReq) { setParkingReqStatus(foundReq.status); setVerificationPin(foundReq.pin || ""); }
      } catch (e) { console.error(e); }
    }
  }, [walletAddress]);

  async function fetchOnChainIdentity(address: string) {
    try {
      if (!window.ethereum) return;
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const deployedContract = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, provider);
      const data = (await deployedContract.getIdentity(address)) as IdentityResultLike;
      const hash = typeof data[0] === "string" ? data[0] : "";
      const cid = typeof data[1] === "string" ? data[1] : "";
      const verified = typeof data[3] === "boolean" ? data[3] : false;
      const revoked = typeof data[4] === "boolean" ? data[4] : false;
      if (!hash) { setOnChainStatus("Not Registered"); return; }
      setOnChainHash(hash); setOnChainCid(cid);
      if (revoked) setOnChainStatus("Revoked"); else if (verified) setOnChainStatus("Verified"); else setOnChainStatus("Pending");
    } catch (error) { console.error(error); }
  }

  async function connectWallet() {
    try {
      if (!window.ethereum) { setStatusMessage("MetaMask is not installed."); return; }
      setIsConnecting(true); setStatusMessage("Connecting to MetaMask...");
      const accounts = await window.ethereum.request<string[]>({ method: "eth_requestAccounts" });
      const selectedAccount = accounts[0];
      if (!selectedAccount) return;
      setWalletAddress(selectedAccount); window.localStorage.setItem("lotte_wallet_address", selectedAccount);
      setStatusMessage(`Wallet connected.`); fetchOnChainIdentity(selectedAccount);
    } catch { setStatusMessage("Wallet connection failed."); } finally { setIsConnecting(false); }
  }

  async function uploadToPinata() {
    if (!PINATA_JWT || !selectedFile) { setStatusMessage("Missing Pinata JWT or file."); return; }
    try {
      setIsUploading(true); setStatusMessage("Uploading to IPFS...");
      const formData = new FormData(); formData.append("file", selectedFile);
      const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", { method: "POST", headers: { Authorization: `Bearer ${PINATA_JWT}` }, body: formData });
      const responseData = await response.json();
      if (!response.ok || !responseData.IpfsHash) { setStatusMessage(responseData.error ?? "Upload failed."); return; }
      setIpfsCID(responseData.IpfsHash); setStatusMessage("IPFS upload successful.");
    } catch (error) { setStatusMessage(`IPFS upload failed: ${getErrorMessage(error)}`); } finally { setIsUploading(false); }
  }

  async function registerWeb3Identity() {
    if (!walletAddress || !visitorName.trim() || !ipfsCID) { setStatusMessage("Complete all fields and IPFS upload."); return; }
    try {
      setIsRegistering(true); setStatusMessage("Creating identity request...");
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, signer);
      const tx = await contract.registerIdentity(identityHashPreview, ipfsCID);
      await tx.wait();
      setStatusMessage("DID request created. Waiting for Lotte Mall Admin approval.");
      appendAuditLog({ id: `${Date.now()}`, action: "Register Identity Request", walletOrDid: did, status: "Pending", txHash: tx.hash, time: new Date().toLocaleString() });
      fetchOnChainIdentity(walletAddress);
    } catch (error) { setStatusMessage(`Registration failed: ${getErrorMessage(error)}`); } finally { setIsRegistering(false); }
  }

  const handleRequestServiceCheck = () => {
    if (!walletAddress) { setStatusMessage("Please connect wallet first."); return; }
    if (onChainStatus !== "Verified") { setStatusMessage("❌ Tài khoản phải VERIFIED mới có thể check-in."); return; }
    try {
      const generatedPin = String(Math.floor(1000 + Math.random() * 9000));
      const currentReqs = JSON.parse(window.localStorage.getItem(PARKING_REQ_KEY) || "[]");
      const filtered = currentReqs.filter((r: any) => r.wallet.toLowerCase() !== walletAddress.toLowerCase());
      const newReq = { id: `req-${Date.now()}`, wallet: walletAddress, name: visitorName, ipfsCid: onChainCid, service: "Beauty Workshop Desk A1", status: "sent", pin: generatedPin, time: new Date().toLocaleTimeString() };
      window.localStorage.setItem(PARKING_REQ_KEY, JSON.stringify([newReq, ...filtered]));
      setVerificationPin(generatedPin); setParkingReqStatus("sent");
    } catch (err) { console.error(err); }
  };

  const handleSubmitAppeal = () => {
    try {
      const existingAppealsRaw = window.localStorage.getItem(APPEALS_KEY);
      const currentAppeals = existingAppealsRaw ? JSON.parse(existingAppealsRaw) : [];
      const newAppeal = { id: `appeal-${Date.now()}`, wallet: walletAddress, name: web2User?.name || "Visitor", reason: appealReason.trim(), time: new Date().toLocaleString() };
      window.localStorage.setItem(APPEALS_KEY, JSON.stringify([newAppeal, ...currentAppeals]));
      setIsAppealSubmitted(true); setStatusMessage("✅ Appeal case registered.");
    } catch (e) { console.error(e); }
  };

  function handleLogout() { window.localStorage.removeItem("lotte_web2_user"); window.localStorage.removeItem("lotte_wallet_address"); router.push("/"); }

  if (!web2User) return null;

  return (
    <main className="min-h-screen text-[#151515] relative overflow-hidden" style={{ background: "radial-gradient(circle at 0% 0%, rgba(227, 6, 19, 0.16), transparent 32%), radial-gradient(circle at 94% 16%, rgba(227, 6, 19, 0.12), transparent 28%), radial-gradient(circle at 95% 100%, rgba(227, 6, 19, 0.22), transparent 34%), linear-gradient(135deg, #fff8f6 0%, #fffdfc 48%, #fff0ee 100%)" }}>
      <div className="pointer-events-none absolute -left-44 -top-44 z-0 h-[460px] w-[460px] rounded-full bg-[#E30613]/15 blur-3xl"></div>
      <div className="pointer-events-none absolute -bottom-48 -right-40 z-0 h-[560px] w-[560px] rounded-full bg-[#E30613]/20 blur-3xl"></div>
      <div className="pointer-events-none absolute right-[8%] top-28 z-0 hidden h-44 w-44 rotate-12 rounded-[3.5rem] bg-[#E30613]/10 lg:block"></div>

      <section className="relative z-10 mx-auto max-w-[1280px] px-8 py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[1.5rem] bg-white shadow-xl shadow-red-100">
              <img src="/lotte%20mall.png" alt="Lotte Mall" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.42em] text-[#E30613]">Lotte Mall West Lake</p>
              <h1 className="text-2xl font-black tracking-tight">Visitor DID Wallet</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveTab("wallet")} className={`rounded-full px-5 py-3 text-sm font-black shadow-sm transition ${activeTab === 'wallet' ? 'bg-red-50 text-[#E30613] border-red-200 border' : 'bg-white border-red-100 border'}`}>My DID</button>
            <button onClick={() => setActiveTab("pin")} className={`rounded-full px-5 py-3 text-sm font-black shadow-sm transition ${activeTab === 'pin' ? 'bg-red-50 text-[#E30613] border-red-200 border' : 'bg-white border-red-100 border'}`}>Generate PIN</button>
            <Link href="/transactions" className="rounded-full border border-red-100 bg-white/90 px-5 py-3 text-sm font-black shadow-sm">Audit Log</Link>
            <button onClick={connectWallet} disabled={isConnecting} className="rounded-full bg-[#E30613] px-5 py-3 text-sm font-black text-white shadow-xl shadow-red-200">
              {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Connect Wallet"}
            </button>
            <button onClick={handleLogout} className="rounded-full border border-neutral-200 bg-neutral-100 px-5 py-3 text-sm font-black text-neutral-500 shadow-sm">Logout</button>
          </div>
        </header>

        {activeTab === "wallet" && (
          <section className="mt-14 grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-red-100 bg-white/85 px-5 py-3 text-sm font-black text-[#E30613] shadow-sm">
                <span className="h-3 w-3 rounded-full bg-[#E30613]"></span>Visitor Digital Identity
              </div>
              <h2 className="text-6xl font-black tracking-tight leading-[0.92]">Your mall identity, <span className="text-[#E30613]">private by design.</span></h2>
              <div className="mt-8 rounded-[2rem] border border-red-100 bg-white/90 p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-400">System Message</p>
                <p className="mt-2 text-sm font-black text-neutral-800">{statusMessage}</p>
              </div>
            </div>
            
            <div className="rounded-[2.7rem] border border-red-100 bg-white p-6 shadow-2xl shadow-red-100">
              <div className="rounded-[2.1rem] bg-gradient-to-br from-[#E30613] via-[#c9000f] to-[#760006] p-7 text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.36em] text-white/55">Lotte Visitor DID Card</p>
                    <h3 className="mt-4 text-3xl font-black">{walletAddress ? "Digital Wallet Active" : "Wallet Required"}</h3>
                  </div>
                  <div className="rounded-2xl bg-white/15 px-5 py-4 text-right">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-white/50">Status</p>
                    <p className="mt-1 text-sm font-black">{onChainStatus}</p>
                  </div>
                </div>
                <div className="mt-8 space-y-4 rounded-[1.7rem] bg-white/10 p-5">
                  <div><p className="text-xs font-black uppercase tracking-[0.24em] text-white/45">Visitor DID</p><p className="mt-1 break-all text-sm font-bold">{did}</p></div>
                  <div><p className="text-xs font-black uppercase tracking-[0.24em] text-white/45">Identity Hash</p><p className="mt-1 break-all text-sm font-bold">{onChainHash || identityHashPreview}</p></div>
                  <div><p className="text-xs font-black uppercase tracking-[0.24em] text-white/45">IPFS CID</p><p className="mt-1 break-all text-sm font-bold">{onChainCid || ipfsCID || "Not uploaded"}</p></div>
                </div>
              </div>
              
              {onChainStatus === "Not Registered" && walletAddress && (
                 <div className="mt-6 p-6 rounded-[2rem] border border-neutral-100 bg-[#fffaf8]">
                   <h3 className="font-black text-xl mb-4">Identity Proof</h3>
                   <input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} className="mb-4 w-full" />
                   <div className="flex gap-4">
                     <button onClick={uploadToPinata} disabled={!selectedFile || isUploading} className="bg-blue-600 text-white font-black text-sm px-5 py-3 rounded-xl">{isUploading ? "Uploading..." : "Generate IPFS CID"}</button>
                     <button onClick={registerWeb3Identity} disabled={!ipfsCID || isRegistering} className="bg-neutral-900 text-white font-black text-sm px-5 py-3 rounded-xl">{isRegistering ? "Anchoring..." : "Anchor DID Request"}</button>
                   </div>
                 </div>
              )}
              {onChainStatus === "Revoked" && (
                <div className="mt-6 p-6 rounded-[2rem] border border-red-200 bg-red-50">
                  <p className="text-xs font-black uppercase text-red-600 mb-2">File Appeal</p>
                  {isAppealSubmitted ? <p className="font-bold text-red-800">Appeal transmitted.</p> : (
                    <>
                      <textarea value={appealReason} onChange={e => setAppealReason(e.target.value)} className="w-full rounded-xl p-3 text-sm outline-none border mb-2" placeholder="Reason..." />
                      <button onClick={handleSubmitAppeal} className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black">Submit Appeal</button>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "pin" && (
          <section className="mt-14 grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-red-100 bg-white/85 px-5 py-3 text-sm font-black text-[#E30613] shadow-sm">
                <span className="h-3 w-3 rounded-full bg-[#E30613]"></span>Visitor Event Check-in
              </div>
              <h2 className="max-w-[610px] text-6xl font-black leading-[0.92] tracking-[-0.07em]">Generate PIN for <span className="text-[#E30613]">event access.</span></h2>
              <div className="mt-8 rounded-[2rem] border border-red-100 bg-white/90 p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-400">System Message</p>
                <p className="mt-2 text-sm font-black text-green-700">Identity verified. You can request event check-in.</p>
              </div>
            </div>

            <div className="grid gap-7">
              <div className="rounded-[2.7rem] border border-red-100 bg-white/92 p-7 shadow-sm">
                <p className="text-sm font-black uppercase tracking-[0.32em] text-[#E30613]">Event Desk Selection</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-neutral-100 bg-[#fffaf8] p-5"><p className="text-xs font-black uppercase text-neutral-400">Event</p><p className="mt-2 text-lg font-black">Lotte Beauty Workshop 2026</p></div>
                  <div className="rounded-2xl border border-neutral-100 bg-[#fffaf8] p-5"><p className="text-xs font-black uppercase text-neutral-400">Desk</p><p className="mt-2 text-lg font-black">Desk A1</p></div>
                </div>
                {parkingReqStatus === "idle" && (
                  <button onClick={handleRequestServiceCheck} className="mt-6 w-full rounded-2xl bg-[#E30613] px-5 py-4 text-sm font-black text-white shadow-xl shadow-red-200">Request Station Check-In</button>
                )}
              </div>

              {parkingReqStatus === "sent" && (
                <div className="rounded-[2.7rem] border border-red-100 bg-white/92 p-7 shadow-sm animate-fadeIn">
                  <p className="text-sm font-black uppercase tracking-[0.32em] text-[#E30613]">Temporary PIN</p>
                  <div className="mt-6 rounded-[2rem] border border-red-100 bg-[#fff4f1] p-6">
                    <p className="text-xs font-black uppercase tracking-[0.28em] text-[#E30613]">Active Check-in PIN</p>
                    <p className="mt-3 text-7xl font-black tracking-[-0.08em] text-[#E30613]">{verificationPin}</p>
                    <p className="text-xs font-semibold text-neutral-600 mt-4">Show this PIN to the event desk for verification. Raw PII remains hidden.</p>
                  </div>
                </div>
              )}
              {parkingReqStatus === "approved" && (
                <div className="rounded-[2.7rem] border border-green-200 bg-green-50 p-7 shadow-sm">
                  <p className="text-2xl font-black text-green-800">✅ Access Granted by Merchant</p>
                  <button onClick={() => setParkingReqStatus("idle")} className="mt-4 bg-white border border-green-200 text-green-800 font-bold px-4 py-2 rounded-xl text-sm">Create New Session</button>
                </div>
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}