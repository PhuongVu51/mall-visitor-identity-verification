"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import CryptoJS from "crypto-js";
import contractABI from "../constants/contractABI.json";

// Cấu hình địa chỉ Contract đã deploy trên Hardhat/Sepolia
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const PARKING_REQ_KEY = "lotte_parking_requests";

type UserSession = { role: "visitor" | "admin" | "merchant"; name: string; email: string; };

export default function VerifyPage() {
  const [inputPin, setInputPin] = useState("");
  const [systemMessage, setSystemMessage] = useState("Merchant Desk initialized. Connect wallet to validate credentials.");
  
  // Trạng thái hàng đợi và ví được mở khóa ngầm
  const [parkingRequests, setParkingRequests] = useState<any[]>([]);
  const [unlockedWallet, setUnlockedWallet] = useState<string | null>(null);
  
  // Trạng thái kết nối ví MetaMask của Merchant
  const [merchantWallet, setMerchantWallet] = useState<string>("");
  const [isProcessingTx, setIsProcessingTx] = useState(false);

  const loadRequests = () => {
    const reqs = JSON.parse(window.localStorage.getItem(PARKING_REQ_KEY) || "[]");
    setParkingRequests(reqs);
  };

  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, 2000);
    return () => clearInterval(interval);
  }, []);

  // 🦊 1. HÀM KẾT NỐI VÍ METAMASK CHO MERCHANT
  const connectMerchantWallet = async () => {
    try {
      if (!(window as any).ethereum) {
        setSystemMessage("❌ MetaMask is not installed!");
        return;
      }
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setMerchantWallet(accounts[0]);
      setSystemMessage("✅ Merchant wallet connected successfully.");
    } catch (error) {
      console.error(error);
      setSystemMessage("❌ Failed to connect Merchant wallet.");
    }
  };

  // 🔒 2. LOGIC BẢO MẬT: Mở khóa bằng mã PIN (Không cần nhập địa chỉ ví)
  const handleUnlockCounterAction = () => {
    if (!inputPin.trim() || inputPin.length !== 4) {
      alert("❌ Vui lòng nhập đủ 4 số mã PIN từ khách hàng.");
      return;
    }
    
    // Tìm kiếm trong hàng đợi dựa trên mã PIN duy nhất
    const found = parkingRequests.find(r => r.pin.trim() === inputPin.trim() && r.status === "sent");
    
    if (found) {
      // Lưu địa chỉ ví ngầm vào state, tuyệt đối KHÔNG hiển thị ra UI
      setUnlockedWallet(found.wallet);
      setSystemMessage("✓ PIN Code Matched. Console unlocked securely.");
    } else {
      setUnlockedWallet(null);
      alert("❌ Mã PIN đối soát không chính xác hoặc phiên yêu cầu đã hết hạn/bị hủy!");
    }
  };

  // 🔗 3. THỰC THI GIAO DỊCH ON-CHAIN: Merchant ký xác nhận bằng MetaMask
  const handleExecuteDecision = async (statusDecision: "approved" | "rejected") => {
    if (!unlockedWallet) return;
    if (!merchantWallet) {
      alert("❌ Vui lòng kết nối ví Merchant (MetaMask) trước khi duyệt lệnh On-chain!");
      return;
    }

    try {
      setIsProcessingTx(true);
      setSystemMessage(`⏳ Processing ${statusDecision.toUpperCase()} transaction on-chain via MetaMask...`);

      // Khởi tạo Provider và Signer từ MetaMask của Merchant
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, signer);

      let actualTxHash = "rejected-offchain";

      // Chỉ thực thi giao dịch On-chain nếu là Approve
      // *Lưu ý: Đoạn này tui dùng hàm verifyIdentity tạm thời. Nếu sau này Smart Contract
      // của bạn có hàm riêng như recordCheckIn(wallet, serviceName), hãy thay thế vào đây.
      if (statusDecision === "approved") {
        try {
          const tx = await contract.verifyIdentity(unlockedWallet);
          setSystemMessage("⏳ Transaction submitted. Waiting for block confirmation...");
          await tx.wait(); // Chờ giao dịch được đào thành công
          actualTxHash = tx.hash; // Lấy mã băm giao dịch THỰC TẾ từ mạng lưới Blockchain
        } catch (contractError) {
          console.error("Contract Error:", contractError);
          alert("❌ Giao dịch On-chain thất bại (User rejected hoặc Lỗi Contract).");
          setIsProcessingTx(false);
          setSystemMessage("Merchant Desk initialized. Connect wallet to validate credentials.");
          return;
        }
      }

      // Xử lý cập nhật trạng thái đơn (Off-chain Queue)
      const currentReqs = JSON.parse(window.localStorage.getItem(PARKING_REQ_KEY) || "[]");
      const updated = currentReqs.map((r: any) => {
        if (r.wallet.toLowerCase() === unlockedWallet.toLowerCase()) return { ...r, status: statusDecision };
        return r;
      });
      window.localStorage.setItem(PARKING_REQ_KEY, JSON.stringify(updated));
      setParkingRequests(updated);

      // Lưu log kiểm toán hệ thống (Audit Trail)
      const logs = JSON.parse(window.localStorage.getItem("lotte_transaction_logs") || "[]");
      logs.unshift({
        id: `check-${Date.now()}`,
        action: "Merchant Verification",
        walletOrDid: `did:lotte:${unlockedWallet.slice(0,8)}...`, // Vẫn che giấu ví khách
        status: statusDecision === "approved" ? "Success" : "Denied",
        txHash: actualTxHash, // Lưu mã băm thật sự của mạng lưới
        time: new Date().toLocaleTimeString()
      });
      window.localStorage.setItem("lotte_transaction_logs", JSON.stringify(logs));

      alert(`✅ Giao dịch ${statusDecision.toUpperCase()} đã được ký và xác nhận thành công!`);
      setSystemMessage("✓ Transaction completed. Awaiting next visitor PIN.");
      setUnlockedWallet(null);
      setInputPin("");
    } catch (err) {
      console.error("General Error:", err);
      alert("❌ Đã có lỗi xảy ra trong quá trình xử lý giao dịch.");
      setSystemMessage("Error processing request.");
    } finally {
      setIsProcessingTx(false);
    }
  };

  return (
    <main className="min-h-screen text-[#151515] relative overflow-hidden" style={{ background: "radial-gradient(circle at 0% 0%, rgba(227, 6, 19, 0.14), transparent 32%), radial-gradient(circle at 95% 100%, rgba(227, 6, 19, 0.22), transparent 34%), linear-gradient(135deg, #fff8f6 0%, #fffdfc 48%, #fff0ee 100%)" }}>
      <div className="pointer-events-none absolute -left-44 -top-44 z-0 h-[460px] w-[460px] rounded-full bg-[#E30613]/15 blur-3xl"></div>
      <div className="pointer-events-none absolute -bottom-48 -right-40 z-0 h-[560px] w-[560px] rounded-full bg-[#E30613]/20 blur-3xl"></div>

      <section className="relative z-10 mx-auto max-w-[1180px] px-8 py-10">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[1.3rem] bg-white shadow-xl shadow-red-100">
              <img src="/lotte%20mall.png" alt="Lotte Mall" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.42em] text-[#E30613]">Lotte Mall West Lake</p>
              <h1 className="text-2xl font-black tracking-tight">Merchant / Event Desk</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/transactions" className="rounded-full border border-red-100 bg-white/90 px-5 py-3 text-sm font-black shadow-sm transition hover:bg-red-50 hover:text-red-700">Audit Log</Link>
            
            {/* NÚT KẾT NỐI VÍ MERCHANT */}
            <button 
              onClick={connectMerchantWallet}
              className={`rounded-full px-5 py-3 text-sm font-black text-white shadow-xl transition ${merchantWallet ? 'bg-green-600 shadow-green-200' : 'bg-[#E30613] shadow-red-200 hover:-translate-y-0.5'}`}
            >
              {merchantWallet ? `Connected: ${merchantWallet.slice(0,6)}...${merchantWallet.slice(-4)}` : "Connect Merchant Wallet"}
            </button>

            <button className="rounded-full border border-neutral-200 bg-neutral-100 px-5 py-3 text-sm font-black text-neutral-500 shadow-sm" onClick={() => {window.localStorage.removeItem("lotte_web2_user"); window.location.href="/";}}>Logout</button>
          </div>
        </header>

        {/* Hero Section */}
        <section className="mb-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-red-100 bg-white/85 px-5 py-3 text-sm font-black text-[#E30613] shadow-sm">
              <span className="h-3 w-3 rounded-full bg-[#E30613]"></span>Merchant / Service Desk
            </div>
            <h2 className="max-w-[610px] text-6xl font-black leading-[0.92] tracking-[-0.07em]">Verify visitor <span className="text-[#E30613]">access securely.</span></h2>
          </div>
          <div className="rounded-[2.5rem] border border-red-100 bg-white/90 p-7 shadow-2xl shadow-red-100">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-400">Merchant System Message</p>
            <p className={`mt-3 text-base font-black ${systemMessage.includes("❌") ? "text-red-600" : "text-green-700"}`}>
              {systemMessage}
            </p>
            <div className="mt-5 rounded-[1.7rem] bg-[#fff4f1] p-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#E30613]">Active Service Point</p>
              <p className="mt-2 text-base font-black">Lotte Beauty Workshop Desk A1</p>
            </div>
          </div>
        </section>

        {/* Main Interface Layout Area */}
        <section className="grid gap-7 pb-10 lg:grid-cols-[0.95fr_1.05fr]">
          
          {/* Left Control Input panel - ĐÃ XÓA Ô NHẬP ĐỊA CHỈ VÍ */}
          <div className="rounded-[2.7rem] border border-red-100 bg-white/92 p-7 shadow-sm">
            <h2 className="text-2xl font-black tracking-tight mb-6">Secure PIN Input</h2>
            <div className="space-y-6">
              
              <div>
                <p className="mb-2 text-xs font-black text-neutral-400 uppercase tracking-widest">Service Point Context</p>
                <div className="rounded-2xl border bg-[#fffaf8] px-5 py-4 text-sm font-black">Beauty Workshop Desk A1</div>
              </div>

              <div>
                <p className="mb-2 text-xs font-black text-[#E30613] uppercase tracking-widest">Enter Visitor's 4-Digit PIN</p>
                <input 
                  value={inputPin} 
                  onChange={(e) => setInputPin(e.target.value)} 
                  maxLength={4} 
                  placeholder="e.g. 4826" 
                  className="w-full rounded-2xl border border-red-200 bg-white px-5 py-6 text-3xl font-black text-center font-mono outline-none shadow-inner focus:border-[#E30613] focus:ring-4 focus:ring-red-50 transition-all" 
                />
              </div>

              <button 
                onClick={handleUnlockCounterAction} 
                disabled={inputPin.length !== 4}
                className="w-full bg-[#111] text-white py-4 font-black rounded-2xl uppercase tracking-wider text-xs shadow-xl transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Scan & Unlock Verification Console
              </button>
            </div>
          </div>

          {/* Right Security Control panel Result view */}
          <div className={`rounded-[2.7rem] border p-7 shadow-sm transition-all duration-300 ${unlockedWallet ? "bg-green-50 border-green-200" : "bg-neutral-50/50 border-neutral-200"}`}>
            <p className="text-sm font-black uppercase tracking-[0.32em] text-neutral-400">Access Decision Panel</p>
            
            {unlockedWallet ? (
              <div className="mt-6 animate-fadeIn">
                <h3 className="text-3xl font-black text-green-800 tracking-tight">Console Decrypted</h3>
                <p className="text-xs text-neutral-600 mt-2">Mã PIN hoàn toàn khớp. Ví khách hàng ẩn danh đã được hệ thống định vị thành công ngoài chuỗi.</p>
                
                {/* HIỂN THỊ NÚT KÝ GIAO DỊCH ON-CHAIN */}
                <div className="grid grid-cols-2 gap-4 mt-8">
                  <button 
                    onClick={() => handleExecuteDecision("approved")} 
                    disabled={isProcessingTx || !merchantWallet}
                    className="bg-green-600 text-white font-black py-5 rounded-2xl shadow-lg uppercase text-xs tracking-widest transition hover:bg-green-700 hover:-translate-y-0.5 disabled:opacity-50 flex flex-col items-center justify-center gap-1"
                  >
                    <span>Approve Access</span>
                    <span className="text-[9px] text-green-200 uppercase tracking-normal opacity-80">(Sign On-Chain)</span>
                  </button>
                  <button 
                    onClick={() => handleExecuteDecision("rejected")} 
                    disabled={isProcessingTx}
                    className="bg-red-600 text-white font-black py-5 rounded-2xl shadow-lg uppercase text-xs tracking-widest transition hover:bg-red-700 hover:-translate-y-0.5 disabled:opacity-50 flex flex-col items-center justify-center gap-1"
                  >
                    <span>Deny Access</span>
                    <span className="text-[9px] text-red-200 uppercase tracking-normal opacity-80">(Off-Chain Record)</span>
                  </button>
                </div>

                {!merchantWallet && (
                  <p className="text-center text-xs font-bold text-red-600 mt-4 animate-pulse">
                    ⚠️ Yêu cầu kết nối ví Merchant ở góc phải màn hình để thực thi Approve.
                  </p>
                )}

                {isProcessingTx && (
                   <p className="text-center text-xs font-bold text-blue-600 mt-4 animate-pulse">
                     ⏳ Đang chờ xác nhận giao dịch qua MetaMask...
                   </p>
                )}

                <div className="mt-8 rounded-2xl bg-white p-5 border border-dashed border-red-200 shadow-sm">
                  <p className="text-xs font-black text-[#E30613] uppercase tracking-wider">🔒 Zero-Exposure Enforcement Active</p>
                  <p className="text-[11px] font-semibold text-neutral-500 mt-2 leading-relaxed">Hệ thống tuân thủ thiết kế giấu PII tuyệt đối. Ảnh chân dung sinh trắc học và thông tin tên tuổi của khách hàng bị chặn hiển thị hoàn toàn khỏi màn hình quầy.</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 font-bold text-neutral-400 border border-dashed border-neutral-300 rounded-[2rem] bg-white mt-4 text-xs shadow-inner">
                <svg className="w-10 h-10 mx-auto text-neutral-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7z"></path></svg>
                Vui lòng nhập mã PIN hợp lệ từ khách hàng <br/>để giải mã bảng điều khiển Access.
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}