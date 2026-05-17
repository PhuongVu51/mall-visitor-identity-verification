"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import CryptoJS from "crypto-js";
import contractABI from "../constants/contractABI.json";

function shortenAddress(address: string) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function AdminPortal() {
  // --- STATES ---
  const [walletAddress, setWalletAddress] = useState("");
  const [statusMessage, setStatusMessage] = useState("Connect MetaMask with Admin Account.");
  const [contract, setContract] = useState<any>(null);

  // States cho cột REGISTER
  const [visitorName, setVisitorName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [visitorWallet, setVisitorWallet] = useState("");
  const [generatedHash, setGeneratedHash] = useState("");

  // States cho cột REVOKE
  const [revokeWallet, setRevokeWallet] = useState("");
  const [revokeReason, setRevokeReason] = useState("");

  // BẮT BUỘC: Đổi địa chỉ này thành địa chỉ Contract MỚI NHẤT của bạn sau khi deploy
  const contractAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";

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

  // --- LOGIC: REVOKE IDENTITY (HÀM QUAN TRỌNG NHẤT) ---
  async function handleRevokeIdentity() {
    try {
      if (!contract) {
        setStatusMessage("❌ Contract not loaded. Please connect wallet.");
        return;
      }
      if (!revokeWallet.trim()) {
        setStatusMessage("❌ Please enter the visitor's wallet address to revoke.");
        return;
      }

      setStatusMessage("⏳ Admin is revoking identity on blockchain...");
      
      // Gọi hàm revokeIdentity từ Smart Contract
      const tx = await contract.revokeIdentity(revokeWallet);
      await tx.wait();

      setStatusMessage("✅ Lệnh khóa thành công! Identity has been revoked.");
      setRevokeWallet("");
      setRevokeReason("");
    } catch (err: any) {
      console.error(err);
      setStatusMessage("❌ Revoke failed: " + (err.reason || err.message));
    }
  }

  return (
    <main className="min-h-screen bg-[#fff8f6] text-[#151515]">
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-[#fff4f1] to-[#ffe1dc] pb-10">
        <div className="relative mx-auto max-w-7xl px-6 py-7">
          {/* NAV BAR */}
          <nav className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-[#E30613] text-3xl font-black text-white shadow-xl shadow-red-200">
                L
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-[#E30613]">Lotte Mall West Lake</p>
                <h1 className="text-xl font-black tracking-tight md:text-2xl">Admin Portal</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/" className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm backdrop-blur transition hover:border-[#E30613] hover:text-[#E30613]">Home</Link>
              <Link href="/visitor" className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm backdrop-blur transition hover:border-[#E30613] hover:text-[#E30613]">Visitor Wallet</Link>
              <button
                onClick={connectWallet}
                className="rounded-full bg-[#E30613] px-5 py-3 text-sm font-black text-white shadow-xl shadow-red-200 transition hover:-translate-y-0.5 hover:bg-[#bd000a]"
              >
                {walletAddress ? shortenAddress(walletAddress) : "Connect Admin Wallet"}
              </button>
            </div>
          </nav>

          <div className="mt-12">
            <div className="inline-flex items-center gap-3 rounded-full border border-red-100 bg-white/85 px-5 py-3 text-sm font-black text-[#E30613] shadow-sm backdrop-blur">
              <span className="flex h-3 w-3 rounded-full bg-[#E30613]" /> Lotte Mall Admin
            </div>
            <h2 className="mt-6 max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.055em] text-[#111] md:text-7xl">
              Register visitor identity <span className="text-[#E30613]">without storing raw data.</span>
            </h2>
            
            {/* THÔNG BÁO TRẠNG THÁI */}
            <div className="mt-6 max-w-2xl rounded-[1.75rem] border border-red-100 bg-white p-5 shadow-sm">
               <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">Admin Status</p>
               <p className={`mt-2 font-bold ${statusMessage.includes("❌") ? "text-red-500" : "text-green-600"}`}>
                 {statusMessage}
               </p>
            </div>
          </div>
        </div>
      </section>

      {/* ADMIN CONTROLS: REGISTER & REVOKE */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-2">
          
          {/* CỘT TRÁI: REGISTER IDENTITY (Mô phỏng băm dữ liệu) */}
          <div className="rounded-[2.5rem] border border-red-100 bg-white p-8 shadow-xl shadow-red-50">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">Register Identity</p>
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
              {/* Nút Register này hiện tại chỉ mô phỏng ở trang Admin. Đăng ký thật diễn ra ở máy Visitor */}
              <button className="rounded-xl bg-[#E30613] px-6 py-3 font-black text-white shadow-lg hover:bg-[#bd000a] opacity-50 cursor-not-allowed">
                Register (Visitor action)
              </button>
            </div>

            {generatedHash && (
              <div className="mt-6 rounded-2xl bg-neutral-900 p-5 text-white">
                <p className="text-xs font-black uppercase text-white/50">Generated Hash (Off-chain)</p>
                <p className="mt-2 break-all font-mono text-sm">{generatedHash}</p>
              </div>
            )}
          </div>

          {/* CỘT PHẢI: REVOKE IDENTITY (Thu hồi danh tính) */}
          <div className="rounded-[2.5rem] border border-red-100 bg-white p-8 shadow-xl shadow-red-50">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">Revoke Identity</p>
            <h3 className="mt-2 text-4xl font-black tracking-tight">Cancel verification</h3>
            <p className="mt-4 leading-7 text-neutral-600">
              Revoking means the admin cancels the identity validity. Merchants will deny access when checking this visitor DID.
            </p>

            <div className="mt-8 space-y-4">
              <div>
                <label className="text-xs font-bold text-neutral-500">Visitor Wallet Address to Revoke</label>
                <input 
                  type="text" 
                  placeholder="0x..." 
                  value={revokeWallet} 
                  onChange={(e)=>setRevokeWallet(e.target.value)} 
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#fffaf8] p-3 outline-none focus:border-[#E30613]" 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-500">Revocation Reason (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Incorrect visitor information" 
                  value={revokeReason} 
                  onChange={(e)=>setRevokeReason(e.target.value)} 
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#fffaf8] p-3 outline-none focus:border-[#E30613]" 
                />
              </div>
            </div>

            <button 
              onClick={handleRevokeIdentity} 
              className="mt-6 rounded-xl bg-[#111] px-8 py-4 font-black text-white shadow-xl transition hover:bg-[#E30613] hover:shadow-red-200"
            >
              Revoke Identity
            </button>

            <div className="mt-8 rounded-2xl bg-[#fff4f1] p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#E30613]">Example Cases</p>
              <ul className="mt-3 list-inside list-disc space-y-2 text-sm font-medium text-neutral-700">
                <li>Incorrect visitor data</li>
                <li>Suspicious wallet usage</li>
                <li>Visitor requests identity deactivation</li>
              </ul>
            </div>
          </div>

        </div>
      </section>
    </main>
  );
}