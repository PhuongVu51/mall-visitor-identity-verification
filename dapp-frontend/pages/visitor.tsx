import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { ethers } from "ethers";
import CryptoJS from "crypto-js";
import contractABI from "../constants/contractABI.json";

type EthereumRequestArgs = { method: string; params?: unknown[] };
type EthereumProvider = { request: <T = unknown>(args: EthereumRequestArgs) => Promise<T> };
declare global { interface Window { ethereum?: EthereumProvider; } }

type IdentityStatus = "Not Registered" | "Pending" | "Verified" | "Revoked";

function shortenAddress(address: string) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getStatusStyle(status: IdentityStatus) {
  if (status === "Verified") return "bg-green-100 text-green-700 border-green-200";
  if (status === "Revoked") return "bg-red-100 text-red-700 border-red-200";
  if (status === "Pending") return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-neutral-100 text-neutral-600 border-neutral-200";
}

export default function VisitorWalletPage() {
  const router = useRouter();
  const [web2User, setWeb2User] = useState<any>(null);

  // ⚠️ PASTE YOUR CONTRACT ADDRESS AND JWT HERE:
  const contractAddress = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788";
  const PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI2Nzg3ZTE2MC0yZDExLTQ3MWQtYjU1ZS02OTJiMDc2ZGY2ZDEiLCJlbWFpbCI6InZ1cGh1b25nMDUwMTIwMDVAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6ImY1MjBlYTZkMjk1YjhkOGIzMjM0Iiwic2NvcGVkS2V5U2VjcmV0IjoiNjM3MTJiMzY4NTI0ZWU5OTI3NDFmODYwMjBlNGIwMmIxMzA3OWI1Y2RmOTM5Y2FlZTlhMDgzMjcyMzM2MTI4OSIsImV4cCI6MTgxMDY1Mzk3OX0.Qho2Ux0HFO6OWtRqua2Zoce6xAZC_5y6LMrCkwckv98";

  // --- WEB3 STATES ---
  const [walletAddress, setWalletAddress] = useState("");
  const [statusMessage, setStatusMessage] = useState("Connect MetaMask to manage your digital identity.");

  const [onChainStatus, setOnChainStatus] = useState<IdentityStatus>("Not Registered");
  const [onChainHash, setOnChainHash] = useState("");
  const [onChainCid, setOnChainCid] = useState("");
  const [onChainDate, setOnChainDate] = useState("");

  // --- REGISTER STATES ---
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ipfsCID, setIpfsCID] = useState("");

  const currentAccess = ["Parking", "Event Desk", "Merchant Check"];

  // 1. Check Web2 Session
  useEffect(() => {
    const currentUser = window.localStorage.getItem("lotte_web2_user");
    if (!currentUser) {
      router.push("/");
    } else {
      const parsedUser = JSON.parse(currentUser);
      setWeb2User(parsedUser);
      if (parsedUser.name) setVisitorName(parsedUser.name);
      if (parsedUser.phone) setVisitorPhone(parsedUser.phone);
    }

    // KHÔNG tự động lấy ví cũ từ localStorage nếu chưa thực sự kết nối ở phiên này
    // Điều này giúp tránh việc UI bị nhận nhầm trạng thái khi chưa kết nối ví MetaMask
    setWalletAddress(""); 
  }, [router]);

  // 2. Fetch Blockchain Data
  async function fetchOnChainIdentity(address: string) {
    try {
      if (!window.ethereum) return;
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const deployedContract = new ethers.Contract(contractAddress, contractABI.abi, provider);
      
      const data = await deployedContract.getIdentity(address);
      const hash = data[0];
      const cid = data[1];
      const timestamp = Number(data[2]);
      const verified = data[3];
      const revoked = data[4];

      if (!hash || hash === "") {
        setOnChainStatus("Not Registered");
      } else {
        setOnChainHash(hash);
        setOnChainCid(cid);
        setOnChainDate(new Date(timestamp * 1000).toLocaleString());
        if (revoked) setOnChainStatus("Revoked");
        else if (verified) setOnChainStatus("Verified");
        else setOnChainStatus("Pending");
      }
    } catch (err) {
      console.error("Fetch on-chain error:", err);
    }
  }

  // 3. Connect Wallet
  async function connectWallet() {
    try {
      if (!window.ethereum) return setStatusMessage("❌ MetaMask is not installed.");
      setStatusMessage("⏳ Connecting to MetaMask...");
      
      const accounts = await window.ethereum.request<string[]>({ method: "eth_requestAccounts" });
      const selectedAccount = accounts[0];
      
      setWalletAddress(selectedAccount);
      window.localStorage.setItem("lotte_wallet_address", selectedAccount);
      
      setStatusMessage(`✅ Wallet connected: ${shortenAddress(selectedAccount)}`);
      await fetchOnChainIdentity(selectedAccount);
    } catch (err) {
      setStatusMessage("❌ Wallet connection failed.");
    }
  }

  // 4. Upload Image to IPFS (Pinata)
  async function uploadToPinata() {
    if (!selectedFile) return setStatusMessage("❌ Please select your identity portrait first.");
    try {
      setStatusMessage("⏳ Uploading profile image to decentralized IPFS network...");
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { Authorization: `Bearer ${PINATA_JWT}` },
        body: formData,
      });

      const resData = await res.json();
      if (resData.IpfsHash) {
        setIpfsCID(resData.IpfsHash);
        setStatusMessage("✅ IPFS upload successful! Ready to anchor.");
      }
    } catch (error: any) {
      setStatusMessage("❌ Pinata Error: " + error.message);
    }
  }

  // 5. Register to Smart Contract
  async function registerWeb3Identity() {
    if (!ipfsCID) {
      setStatusMessage("❌ Please upload your image to IPFS before anchoring.");
      return;
    }
    try {
      if (!window.ethereum) return;
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, contractABI.abi, signer);
      
      const rawData = visitorName.trim() + visitorPhone.trim();
      const hash = "0x" + CryptoJS.SHA256(rawData).toString();
      
      setStatusMessage("⏳ Anchoring your digital identity to Blockchain...");
      const tx = await contract.registerIdentity(hash, ipfsCID);
      await tx.wait();
      
      setStatusMessage("✅ DID created successfully! Awaiting Admin verification.");
      await fetchOnChainIdentity(walletAddress);
    } catch (err: any) {
      setStatusMessage("❌ Blockchain Error: " + err.message);
    }
  }

  const handleLogout = () => {
    window.localStorage.removeItem("lotte_web2_user");
    window.localStorage.removeItem("lotte_wallet_address");
    router.push("/");
  };

  if (!web2User) return null;

  return (
    <main className="min-h-screen bg-[#fff8f6] text-[#151515]">
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-[#fff4f1] to-[#ffe3df]">
        <div className="absolute left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-[#E30613]/20 blur-3xl" />
        
        <div className="relative mx-auto max-w-7xl px-6 py-7">
          {/* NAV BAR */}
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E30613] text-2xl font-black text-white shadow-xl">L</div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-[#E30613]">Lotte Mall Visitor</p>
                <h1 className="text-lg font-black tracking-tight">Welcome, {web2User.name}</h1>
              </div>
            </div>
            <button onClick={handleLogout} className="rounded-full border border-red-200 bg-white px-5 py-2.5 text-sm font-black text-[#E30613] shadow-sm hover:bg-red-50">
              Logout
            </button>
          </nav>

          <div className="mt-12 mb-8 max-w-3xl">
             <h2 className="text-4xl font-black md:text-6xl tracking-tight">Web3 <span className="text-[#E30613]">Identity Center.</span></h2>
             <p className="mt-4 text-lg text-neutral-600">Link your personal MetaMask wallet to activate secure, decentralized mall access.</p>
          </div>

          <div className="mb-6 rounded-2xl border border-red-100 bg-white p-4 shadow-sm font-bold text-neutral-800">
             🔔 System: {statusMessage}
          </div>

          {/* SỬA LẠI ĐIỀU KIỆN RENDER CHUẨN XÁC NƠI NÀY */}
          {!walletAddress || walletAddress === "" ? (
            <div className="mt-6 p-8 rounded-[2rem] border border-red-100 bg-white max-w-md shadow-xl">
              <h3 className="text-xl font-black mb-4">Wallet Connection Required</h3>
              <p className="text-sm font-medium text-neutral-500 mb-6">Please link your MetaMask wallet first to access decentralized verification features.</p>
              <button onClick={connectWallet} className="w-full rounded-2xl bg-[#E30613] py-4 text-base font-black text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-[#bd000a]">
                Connect MetaMask Wallet
              </button>
            </div>
          ) : (
            <>
              {/* CHỈ KHI ĐÃ CÓ WALLET ADDRESS MỚI XÉT ĐẾN TRẠNG THÁI TRÊN BLOCKCHAIN */}
              {onChainStatus === "Not Registered" && (
                <div className="mt-8 max-w-md animate-fade-in">
                  <div className="rounded-[2rem] border border-red-100 bg-white p-8 shadow-xl">
                    <h3 className="mb-2 text-2xl font-black text-[#E30613]">Create Lotte DID Card</h3>
                    <p className="text-xs font-semibold text-neutral-400 mb-6 uppercase tracking-wider">Profile: {web2User.name}</p>
                    
                    <div className="space-y-6">
                      <div>
                        <label className="text-xs font-black text-neutral-500 uppercase tracking-wider block mb-2">Select Identity Portrait</label>
                        <input type="file" onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)} className="w-full rounded-xl border border-neutral-200 p-3 text-sm font-medium bg-[#fffaf8]" />
                        
                        <button onClick={uploadToPinata} className="w-full mt-3 rounded-xl bg-blue-600 py-3 text-sm font-black text-white hover:bg-blue-700 shadow-md">
                          Generate IPFS CID
                        </button>
                        {ipfsCID && <p className="text-xs text-green-600 font-bold mt-2 truncate">CID: {ipfsCID}</p>}
                      </div>

                      <button onClick={registerWeb3Identity} className="w-full rounded-xl bg-[#111] py-4 text-sm font-black text-white transition hover:bg-[#E30613] shadow-lg">
                        Anchor Identity to Blockchain
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* HỒ SƠ SAU KHI ĐĂNG KÝ XONG */}
              {onChainStatus !== "Not Registered" && (
                <div className="mt-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                  <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-sm">
                    <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">Visitor Profile</p>
                    <h2 className="mt-2 text-3xl font-black tracking-tight">Identity Overview</h2>

                    <div className="mt-6 space-y-4">
                      <ProfileItem label="Linked Wallet Address" value={shortenAddress(walletAddress)} />
                      <ProfileItem label="Issued At (Blockchain)" value={onChainDate} />
                      
                      {onChainCid && (
                        <div className="rounded-2xl border border-neutral-100 bg-[#fffaf8] p-4">
                          <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-400 mb-2">Decentralized Portrait</p>
                          <img src={`https://ipfs.io/ipfs/${onChainCid}`} alt="Visitor Avatar" className="w-full h-48 object-cover rounded-xl border border-red-200 shadow-sm" />
                        </div>
                      )}
                    </div>

                    <div className={`mt-6 rounded-3xl border p-5 ${getStatusStyle(onChainStatus)}`}>
                      <p className="text-sm font-black uppercase tracking-[0.25em]">Verification Status</p>
                      <p className="mt-2 text-3xl font-black">{onChainStatus}</p>
                    </div>
                  </div>

                  <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-sm">
                    <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">Mall Access</p>
                    <h2 className="mt-2 text-3xl font-black tracking-tight">Authorized Services</h2>

                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                      {currentAccess.map((item) => (
                        <AccessCard key={item} title={item} status={onChainStatus === "Verified" ? "Available" : "Requires verification"} />
                      ))}
                    </div>

                    <div className="mt-6 rounded-[2rem] bg-[#111] p-6 text-white">
                      <p className="text-sm font-black uppercase tracking-[0.28em] text-white/45">Cryptography Security</p>
                      <h3 className="mt-3 text-xl font-black">Identity Hash (On-Chain)</h3>
                      <p className="mt-2 break-all font-mono text-sm text-white/70">{onChainHash}</p>
                      <p className="mt-4 text-sm text-white/50">Your raw personal details are encrypted. Merchants can only verify the cryptographic hash and match your IPFS portrait locally.</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
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
      <h3 className="mt-4 text-lg font-black">{title}</h3>
      <p className={`mt-1 text-sm font-bold ${status === "Available" ? "text-green-600" : "text-[#E30613]"}`}>{status}</p>
    </div>
  );
}