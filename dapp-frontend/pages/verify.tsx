import { useState } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import contractABI from "../constants/contractABI.json";

// LATEST Contract Address của nhóm Jolista
const contractAddress = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788";

export default function VerifyPage() {
  const [inputValue, setInputValue] = useState("");
  const [result, setResult] = useState<"idle" | "verified" | "denied">("idle");
  const [message, setMessage] = useState("Enter visitor Email, Phone, or Wallet Address to verify.");
  const [visitorCid, setVisitorCid] = useState("");

  async function verifyVisitor() {
    if (!inputValue.trim()) {
      setMessage("Please enter an Email, Phone, or Wallet Address.");
      return;
    }

    let targetAddress = inputValue.trim().toLowerCase();

    // Lấy toàn bộ danh sách tài khoản Web2 đã đăng ký từ hệ thống
    const savedUsersRaw = window.localStorage.getItem("lotte_users_db");
    const savedUsers = savedUsersRaw ? JSON.parse(savedUsersRaw) : [];

    // Lấy thông tin ví khách kết nối (được lưu chéo khi khách kết nối ví ở trang visitor)
    const savedWallet = window.localStorage.getItem("lotte_wallet_address");

    // --- TRƯỜNG HỢP 1: NGƯỜI DÙNG NHẬP EMAIL ---
    if (targetAddress.includes("@")) {
      // Tìm tài khoản trong danh sách có Email trùng khớp
      const foundUser = savedUsers.find((u: any) => u.email.toLowerCase() === targetAddress);
      
      if (foundUser) {
        // Luồng Localhost: Lấy ví đang active liên kết làm ví đích để check Blockchain
        if (savedWallet) {
          targetAddress = savedWallet.toLowerCase();
          setMessage(`🔍 Email matched! Mapping to wallet: ${savedWallet.slice(0,6)}...${savedWallet.slice(-4)}. Checking Blockchain...`);
        } else {
          setResult("denied");
          setVisitorCid("");
          setMessage("ACCESS DENIED: This Email exists but hasn't linked any Web3 wallet yet.");
          return;
        }
      } else {
        setResult("denied");
        setVisitorCid("");
        setMessage("ACCESS DENIED: Visitor email not found in local database.");
        return;
      }
    } 
    // --- TRƯỜNG HỢP 2: NGƯỜI DÙNG NHẬP SỐ ĐIỆN THOẠI (CHỈ GỒM CÁC CHỮ SỐ) ---
    else if (/^\d+$/.test(targetAddress)) {
      // Tìm tài khoản trong danh sách có Số điện thoại trùng khớp
      const foundUser = savedUsers.find((u: any) => u.phone === targetAddress);
      
      if (foundUser) {
        if (savedWallet) {
          targetAddress = savedWallet.toLowerCase();
          setMessage(`🔍 Phone matched! Mapping to wallet: ${savedWallet.slice(0,6)}...${savedWallet.slice(-4)}. Checking Blockchain...`);
        } else {
          setResult("denied");
          setVisitorCid("");
          setMessage("ACCESS DENIED: This Phone number exists but hasn't linked any Web3 wallet yet.");
          return;
        }
      } else {
        setResult("denied");
        setVisitorCid("");
        setMessage("ACCESS DENIED: Visitor phone number not found in local database.");
        return;
      }
    }

    // --- TRƯỜNG HỢP 3: KHỬ ĐỊNH DẠNG DID (NẾU CÓ) ---
    if (targetAddress.startsWith("did:lotte:")) {
      targetAddress = targetAddress.replace("did:lotte:", "");
    }

    // Kiểm tra tính hợp lệ của địa chỉ ví cuối cùng trước khi gọi Blockchain
    if (!ethers.isAddress(targetAddress)) {
      setResult("denied");
      setMessage("Invalid format. Please enter a valid Email, Phone, or Wallet Address.");
      setVisitorCid("");
      return;
    }

    try {
      if (!window.ethereum) {
        setMessage("MetaMask is not installed.");
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const deployedContract = new ethers.Contract(contractAddress, contractABI.abi, provider);
      
      const data = await deployedContract.getIdentity(targetAddress);
      const hash = data[0];
      const cid = data[1];
      const verified = data[3];
      const revoked = data[4];

      if (!hash || hash === "") {
        setResult("denied");
        setVisitorCid("");
        setMessage("Identity not found on Blockchain. The visitor is not registered.");
      } else if (revoked) {
        setResult("denied");
        setVisitorCid(cid);
        setMessage("ACCESS DENIED: This identity has been REVOKED by Admin.");
      } else if (verified) {
        setResult("verified");
        setVisitorCid(cid);
        setMessage("ACCESS GRANTED: The visitor identity is verified and active.");
      } else {
        setResult("denied");
        setVisitorCid(cid);
        setMessage("ACCESS DENIED: Identity is registered but pending Admin approval.");
      }
    } catch (err) {
      console.error(err);
      setResult("denied");
      setVisitorCid("");
      setMessage("Error communicating with the blockchain.");
    }
  }

  const handleLogout = () => {
    window.localStorage.removeItem("lotte_web2_user");
    window.location.href = "/";
  };

  return (
    <main className="min-h-screen bg-[#fff8f6] text-[#151515]">
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-[#fff4f1] to-[#ffe3df]">
        <div className="absolute left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-[#E30613]/20 blur-3xl" />
        
        <div className="relative mx-auto max-w-7xl px-6 py-7">
          <nav className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <Link href="/admin" className="flex items-center gap-4 group">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-[#E30613] text-3xl font-black text-white shadow-xl transition-transform group-hover:scale-105">L</div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-[#E30613]">Lotte Mall West Lake</p>
                <h1 className="text-xl font-black tracking-tight md:text-2xl group-hover:text-[#E30613] transition-colors">Verification Portal</h1>
              </div>
            </Link>
            
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/admin" className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm transition hover:border-[#E30613] hover:text-[#E30613]">
                Admin Portal
              </Link>
              <button onClick={handleLogout} className="rounded-full border border-neutral-200 bg-neutral-100 px-5 py-3 text-sm font-black text-neutral-500 shadow-sm transition hover:bg-neutral-200 hover:text-neutral-800">
                Logout
              </button>
            </div>
          </nav>

          <div className="grid gap-10 pb-16 pt-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-red-100 bg-white/85 px-5 py-3 text-sm font-black text-[#E30613] shadow-sm">
                <span className="h-3 w-3 rounded-full bg-[#E30613]" /> Merchant / Event Desk / Parking
              </div>
              <h2 className="text-5xl font-black leading-[0.98] tracking-[-0.055em] md:text-7xl">
                Verify visitor access <span className="text-[#E30613]">without seeing private data.</span>
              </h2>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-neutral-700">
                Service counters check the visitor Email, Phone number, or wallet address directly against the Blockchain. Personal details remain protected.
              </p>
              <div className="mt-8 rounded-[1.75rem] border border-red-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-400">System Message</p>
                <p className="mt-2 font-bold text-neutral-900">{message}</p>
              </div>
            </div>

            <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-2xl shadow-red-100">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">Check Visitor</p>
              <h3 className="mt-2 text-3xl font-black">Identity Lookup</h3>

              <label className="mt-6 block">
                <span className="text-sm font-black text-neutral-700">Enter Email, Phone, or Wallet Address</span>
                <input
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  placeholder="e.g. 0912345678, visitor@example.com, or 0x..."
                  className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-semibold outline-none transition focus:border-[#E30613]"
                />
              </label>

              <div className="mt-5 flex flex-wrap gap-3">
                <button onClick={verifyVisitor} className="w-full rounded-2xl bg-[#E30613] px-5 py-4 font-black text-white shadow-xl hover:-translate-y-0.5">
                  Verify On-Chain Status
                </button>
              </div>

              <div className={`mt-6 rounded-[2rem] border p-6 ${result === "verified" ? "border-green-200 bg-green-50 text-green-800" : result === "denied" ? "border-red-200 bg-red-50 text-red-800" : "border-neutral-200 bg-neutral-50 text-neutral-700"}`}>
                <p className="text-sm font-black uppercase tracking-[0.28em]">Result</p>
                <h3 className="mt-3 text-3xl font-black">
                  {result === "verified" ? "Access Granted" : result === "denied" ? "Access Denied" : "Waiting for Check"}
                </h3>
                {result !== "idle" && visitorCid && (
                  <div className="mt-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] mb-2 text-neutral-400">Visitor Photo Verification:</p>
                    <img 
                      src={`https://ipfs.io/ipfs/${visitorCid}`} 
                      alt="Verified Profile" 
                      className="w-full h-48 object-cover rounded-xl border border-neutral-200 shadow-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}