"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import CryptoJS from "crypto-js";
import contractABI from "../constants/contractABI.json";

type IdentityStatus = "None" | "Pending" | "Verified" | "Revoked";

function shortenAddress(address: string) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function AdminPortal() {
  // ⚠️ PASTE YOUR PINATA JWT MASTER KEY HERE:
  const PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI2Nzg3ZTE2MC0yZDExLTQ3MWQtYjU1ZS02OTJiMDc2ZGY2ZDEiLCJlbWFpbCI6InZ1cGh1b25nMDUwMTIwMDVAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6ImY1MjBlYTZkMjk1YjhkOGIzMjM0Iiwic2NvcGVkS2V5U2VjcmV0IjoiNjM3MTJiMzY4NTI0ZWU5OTI3NDFmODYwMjBlNGIwMmIxMzA3OWI1Y2RmOTM5Y2FlZTlhMDgzMjcyMzM2MTI4OSIsImV4cCI6MTgxMDY1Mzk3OX0.Qho2Ux0HFO6OWtRqua2Zoce6xAZC_5y6LMrCkwckv98"; 

  // --- STATES ---
  const [walletAddress, setWalletAddress] = useState("");
  const [statusMessage, setStatusMessage] = useState("Connect MetaMask with Admin Account.");
  const [contract, setContract] = useState<any>(null);

  // States for REGISTER simulation column
  const [visitorName, setVisitorName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [visitorWallet, setVisitorWallet] = useState("");
  const [generatedHash, setGeneratedHash] = useState("");

  // States for IDENTITY CONTROL column
  const [targetWallet, setTargetWallet] = useState("");
  const [currentOnChainStatus, setCurrentOnChainStatus] = useState<IdentityStatus>("None");
  const [isSearching, setIsSearching] = useState(false);

  // Contract Address của nhóm Jolista
  const contractAddress = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788";

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
      const deployedContract = new ethers.Contract(contractAddress, contractABI.abi, signer);

      setWalletAddress(accounts[0]);
      setContract(deployedContract);
      setStatusMessage(`✅ Admin Wallet connected successfully`);
    } catch (err: any) {
      console.error(err);
      setStatusMessage("❌ Wallet connection failed.");
    }
  }

  // --- LOGIC: GENERATE HASH ---
  function handleGenerateHash() {
    if (!visitorName || !phone || !email) {
      setStatusMessage("❌ Please fill in Name, Phone, and Email to generate Hash.");
      return;
    }
    const rawData = visitorName + phone + email;
    const hash = "0x" + CryptoJS.SHA256(rawData).toString();
    setGeneratedHash(hash);
    setStatusMessage("✅ Hash generated successfully! Now you can register.");
  }

  // --- LOGIC: LOOK UP STATUS (KIỂM TRA TRẠNG THÁI) ---
  async function checkVisitorStatus() {
    if (!contract) {
      setStatusMessage("❌ Please connect Admin wallet first.");
      return;
    }
    if (!targetWallet.trim() || !ethers.isAddress(targetWallet.trim())) {
      setStatusMessage("❌ Please enter a valid Wallet Address to look up.");
      return;
    }

    setIsSearching(true);
    setStatusMessage("⏳ Fetching live account status from Blockchain...");
    
    try {
      const data = await contract.getIdentity(targetWallet.trim());
      const hash = data[0];
      const verified = data[3];
      const revoked = data[4];

      if (!hash || hash === "") {
        setCurrentOnChainStatus("None");
        setStatusMessage("❌ This wallet address has not initiated any DID registration requests.");
      } else if (revoked) {
        setCurrentOnChainStatus("Revoked");
        setStatusMessage("⚠️ Identity found: Status is currently REVOKED.");
      } else if (verified) {
        setCurrentOnChainStatus("Verified");
        setStatusMessage("✅ Identity found: Status is currently VERIFIED and Active.");
      } else {
        setCurrentOnChainStatus("Pending");
        setStatusMessage("🔔 Identity found: Status is PENDING approval.");
      }
    } catch (err) {
      console.error(err);
      setStatusMessage("❌ Error fetching status from Smart Contract.");
    } finally {
      setIsSearching(false);
    }
  }

  // --- LOGIC: APPROVE IDENTITY (HÀM ĐÃ ĐƯỢC SỬA CHUẨN ABI) ---
  async function handleApproveIdentity() {
    try {
      if (!contract || !targetWallet.trim()) return;
      setStatusMessage("⏳ Broadcasting Approve transaction to Blockchain...");
      
      const tx = await contract.verifyIdentity(targetWallet.trim());
      await tx.wait();

      setStatusMessage("✅ Success! Identity has been approved and activated.");
      await checkVisitorStatus();
    } catch (err: any) {
      console.error(err);
      setStatusMessage("❌ Approve failed: " + (err.reason || err.message));
    }
  }

  // --- LOGIC: REVOKE IDENTITY ---
  async function handleRevokeIdentity() {
    try {
      if (!contract || !targetWallet.trim()) return;
      setStatusMessage("⏳ Broadcasting Revoke transaction to Blockchain...");
      
      const tx = await contract.revokeIdentity(targetWallet.trim());
      await tx.wait();

      setStatusMessage("✅ Success! Identity has been revoked and blacklisted.");
      await checkVisitorStatus();
    } catch (err: any) {
      console.error(err);
      setStatusMessage("❌ Revoke failed: " + (err.reason || err.message));
    }
  }

  const handleLogout = () => {
    window.localStorage.removeItem("lotte_web2_user");
    window.location.href = "/";
  };

  return (
    <main className="min-h-screen bg-[#fff8f6] text-[#151515]">
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-[#fff4f1] to-[#ffe1dc] pb-10">
        <div className="relative mx-auto max-w-7xl px-6 py-7">
          <nav className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-[#E30613] text-3xl font-black text-white shadow-xl shadow-red-200">L</div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-[#E30613]">Lotte Mall West Lake</p>
                <h1 className="text-xl font-black tracking-tight md:text-2xl">Admin Portal</h1>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/verify" className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm backdrop-blur transition hover:border-[#E30613] hover:text-[#E30613]">
                Verify Desk
              </Link>
              <button
                onClick={connectWallet}
                className="rounded-full bg-[#E30613] px-5 py-3 text-sm font-black text-white shadow-xl shadow-red-200 transition hover:-translate-y-0.5 hover:bg-[#bd000a]"
              >
                {walletAddress ? shortenAddress(walletAddress) : "Connect Admin Wallet"}
              </button>
              <button
                onClick={handleLogout}
                className="rounded-full border border-neutral-200 bg-neutral-100 px-5 py-3 text-sm font-black text-neutral-500 shadow-sm backdrop-blur transition hover:bg-neutral-200 hover:text-neutral-800"
              >
                Logout
              </button>
            </div>
          </nav>

          <div className="mt-12">
            <div className="inline-flex items-center gap-3 rounded-full border border-red-100 bg-white/85 px-5 py-3 text-sm font-black text-[#E30613] shadow-sm backdrop-blur">
              <span className="flex h-3 w-3 rounded-full bg-[#E30613]" /> Lotte Mall Admin
            </div>
            <h2 className="mt-6 max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.055em] text-[#111] md:text-7xl">
              Decentralized identity <span className="text-[#E30613]">management.</span>
            </h2>
            
            <div className="mt-6 max-w-2xl rounded-[1.75rem] border border-red-100 bg-white p-5 shadow-sm">
               <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">Admin System Messages</p>
               <p className={`mt-2 font-bold ${statusMessage.includes("❌") || statusMessage.includes("⚠️") ? "text-red-500" : "text-green-600"}`}>
                 {statusMessage}
               </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-2">
          
          {/* LEFT COLUMN: SIMULATION TOOL */}
          <div className="rounded-[2.5rem] border border-red-100 bg-white p-8 shadow-xl shadow-red-50">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">Simulation Tool</p>
            <h3 className="mt-2 text-4xl font-black tracking-tight">Visitor information</h3>
            
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-neutral-500">Visitor Name</label>
                <input type="text" value={visitorName} onChange={(e)=>setVisitorName(e.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#fffaf8] p-3 outline-none focus:border-[#E30613]" />
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-500">Phone Number</label>
                <input type="text" value={phone} onChange={(e)=>setPhone(e.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#fffaf8] p-3 outline-none focus:border-[#E30613]" />
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-500">Email</label>
                <input type="text" value={email} onChange={(e)=>setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#fffaf8] p-3 outline-none focus:border-[#E30613]" />
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-500">Wallet Address</label>
                <input type="text" value={visitorWallet} onChange={(e)=>setVisitorWallet(e.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#fffaf8] p-3 outline-none focus:border-[#E30613]" />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-4">
              <button onClick={handleGenerateHash} className="rounded-xl border border-red-200 bg-white px-6 py-3 font-black text-[#E30613] hover:bg-red-50">
                Generate Identity Hash
              </button>
            </div>

            {generatedHash && (
              <div className="mt-6 rounded-2xl bg-neutral-900 p-5 text-white">
                <p className="text-xs font-black uppercase text-white/50">Generated Hash (Off-chain)</p>
                <p className="mt-2 break-all font-mono text-sm">{generatedHash}</p>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: ACCESS CONTROL DESK */}
          <div className="rounded-[2.5rem] border border-red-100 bg-white p-8 shadow-xl shadow-red-50">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">Identity Moderation</p>
            <h3 className="mt-2 text-4xl font-black tracking-tight">Access Control Desk</h3>
            <p className="mt-4 leading-7 text-neutral-600">
              Enter a visitor's DID wallet address to look up their live status on the Blockchain. Buttons will adapt dynamically based on their current phase.
            </p>

            <div className="mt-8 space-y-4">
              <div>
                <label className="text-xs font-bold text-neutral-500">Target Visitor Wallet Address (0x...)</label>
                <div className="mt-1 flex gap-3">
                  <input 
                    type="text" 
                    placeholder="Enter 0x..." 
                    value={targetWallet} 
                    onChange={(e)=> {
                      setTargetWallet(e.target.value);
                      setCurrentOnChainStatus("None");
                    }} 
                    className="flex-1 rounded-xl border border-neutral-200 bg-[#fffaf8] p-3 outline-none focus:border-[#E30613] font-mono text-sm" 
                  />
                  <button 
                    onClick={checkVisitorStatus}
                    disabled={isSearching}
                    className="rounded-xl bg-[#E30613] px-5 py-3 font-black text-white hover:bg-[#bd000a] disabled:opacity-50"
                  >
                    {isSearching ? "Searching..." : "Look up"}
                  </button>
                </div>
              </div>
            </div>

            {/* DYNAMIC BUTTON ZONE */}
            <div className="mt-8 pt-6 border-t border-neutral-100">
              <p className="text-xs font-black text-neutral-400 uppercase tracking-wider mb-4">Available Action</p>

              {currentOnChainStatus === "None" && (
                <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4 text-center text-sm font-bold text-neutral-400">
                  Please perform a "Look up" to see available management actions.
                </div>
              )}

              {currentOnChainStatus === "Pending" && (
                <button 
                  onClick={handleApproveIdentity} 
                  className="w-full rounded-xl bg-green-600 py-4 font-black text-white shadow-xl transition hover:bg-green-700 shadow-green-50 text-center"
                >
                  Approve Identity Request
                </button>
              )}

              {currentOnChainStatus === "Verified" && (
                <button 
                  onClick={handleRevokeIdentity} 
                  className="w-full rounded-xl bg-[#111] py-4 font-black text-white shadow-xl transition hover:bg-[#E30613] shadow-red-50 text-center"
                >
                  Revoke Identity Access
                </button>
              )}

              {currentOnChainStatus === "Revoked" && (
                <button 
                  onClick={handleApproveIdentity} 
                  className="w-full rounded-xl bg-blue-600 py-4 font-black text-white shadow-xl transition hover:bg-blue-700 shadow-blue-50 text-center"
                >
                  Re-Approve Identity (Lift Blacklist)
                </button>
              )}
            </div>
          </div>

        </div>
      </section>
    </main>
  );
}