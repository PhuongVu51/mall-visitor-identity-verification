import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import contractABI from "../constants/contractABI.json";

type TxLog = {
  id?: string;
  action: string;
  did?: string;
  walletOrDid?: string;
  wallet?: string; // Đồng bộ trường ví từ admin portal
  status: string;
  txHash: string;
  time: string;
};

type DisplayTxLog = {
  id: string;
  action: string;
  walletOrDid: string;
  status: string;
  txHash: string;
  time: string;
};

type UserSession = {
  role: "visitor" | "admin" | "merchant";
  name: string;
  email: string;
};

// Kiểu dữ liệu đơn khiếu nại đồng bộ hệ thống ngoài chuỗi
type AppealTicket = {
  id: string;
  wallet: string;
  name: string;
  reason: string;
  time: string;
};

const PRIMARY_TX_KEY = "lotte_transaction_logs";
const LEGACY_TX_KEY = "lotte_tx_logs";
const APPEALS_KEY = "lotte_admin_appeals";

const defaultLogs: DisplayTxLog[] = [
  {
    id: "system-ready",
    action: "System Ready",
    walletOrDid: "did:lotte:demo",
    status: "Ready",
    txHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
    time: "Demo start",
  },
];

function normalizeLog(log: TxLog, index: number): DisplayTxLog {
  return {
    id: log.id ?? `${log.txHash}-${log.time}-${index}`,
    action: log.action,
    walletOrDid: log.walletOrDid ?? log.wallet ?? log.did ?? "Not available",
    status: log.status,
    txHash: log.txHash,
    time: log.time,
  };
}

function safeParseLogs(value: string | null): DisplayTxLog[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is TxLog => {
        if (typeof item !== "object" || item === null) return false;

        const log = item as Partial<TxLog>;

        return (
          typeof log.action === "string" &&
          typeof log.status === "string" &&
          typeof log.txHash === "string" &&
          typeof log.time === "string"
        );
      })
      .map(normalizeLog);
  } catch {
    return [];
  }
}

function getStatusClass(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("verified") || normalized.includes("success")) {
    return "bg-green-50 text-green-700 border-green-100";
  }

  if (normalized.includes("pending")) {
    return "bg-yellow-50 text-yellow-700 border-yellow-100";
  }

  if (
    normalized.includes("revoked") ||
    normalized.includes("denied") ||
    normalized.includes("not found")
  ) {
    return "bg-red-50 text-red-700 border-red-100";
  }

  return "bg-[#fff4f1] text-[#E30613] border-red-100";
}

function truncateMiddle(value: string, start = 14, end = 10) {
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export default function TransactionsPage() {
  const [logs, setLogs] = useState<DisplayTxLog[]>(defaultLogs);
  const [currentUserAddress, setCurrentUserAddress] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("visitor");

  // ✅ ĐÃ THÊM: State quản lý danh sách đơn khiếu nại chuyển vùng từ Admin sang
  const [appeals, setAppeals] = useState<AppealTicket[]>([]);

  const actionCounts = useMemo(() => {
    return logs.reduce(
      (accumulator, log) => {
        const action = log.action.toLowerCase();

        if (action.includes("register")) accumulator.register += 1;
        if (action.includes("verify")) accumulator.verify += 1;
        if (action.includes("revoke")) accumulator.revoke += 1;

        return accumulator;
      },
      {
        register: 0,
        verify: 0,
        revoke: 0,
      },
    );
  }, [logs]);

  // Tải danh sách đơn khiếu nại từ bộ nhớ đệm ngoài chuỗi
  const loadAppealsData = () => {
    try {
      const raw = window.localStorage.getItem(APPEALS_KEY);
      if (raw) {
        setAppeals(JSON.parse(raw) as AppealTicket[]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    // 1. Đọc session và ví hiện tại để phân loại tài khoản đăng nhập
    const rawUser = window.localStorage.getItem("lotte_web2_user");
    const activeWallet = window.localStorage.getItem("lotte_wallet_address") || "";
    setCurrentUserAddress(activeWallet.toLowerCase());

    let role = "visitor";
    if (rawUser) {
      try {
        const parsedUser = JSON.parse(rawUser) as UserSession;
        role = parsedUser.role;
        setUserRole(parsedUser.role);
      } catch (e) {
        console.error(e);
      }
    }

    loadAppealsData();

    // 2. Tải và gộp tất cả các nguồn dữ liệu log ngoài chuỗi
    const primaryLogs = safeParseLogs(window.localStorage.getItem(PRIMARY_TX_KEY));
    const legacyLogs = safeParseLogs(window.localStorage.getItem(LEGACY_TX_KEY));
    const secondaryLogs = safeParseLogs(window.localStorage.getItem("lotte_transaction_logs"));
    
    const mergedLogs = [...primaryLogs, ...legacyLogs, ...secondaryLogs];

    // Loại bỏ các bản ghi trùng lặp id
    const uniqueLogsMap = new Map<string, DisplayTxLog>();
    mergedLogs.forEach(log => uniqueLogsMap.set(log.id, log));
    const uniqueLogs = Array.from(uniqueLogsMap.values());

    if (uniqueLogs.length > 0) {
      // 🛡️ BỘ LỌC PHÂN CHIA LỊCH SỬ THÔNG MINH THEO TÀI KHOẢN
      if (role === "visitor" && activeWallet) {
        const cleanWallet = activeWallet.toLowerCase();
        // Tài khoản Visitor chỉ được phép xem các hành động có dính líu đến địa chỉ ví của mình
        const filtered = uniqueLogs.filter(log => 
          log.walletOrDid.toLowerCase().includes(cleanWallet)
        );
        setLogs(filtered.length > 0 ? filtered : defaultLogs);
      } else {
        // Tài khoản Admin hoặc Merchant được quyền xem toàn bộ nhật ký hệ thống
        setLogs(uniqueLogs);
      }
      window.localStorage.setItem(PRIMARY_TX_KEY, JSON.stringify(uniqueLogs));
      return;
    }

    setLogs(defaultLogs);
  }, []);

  // ✅ ĐÃ THÊM: Xử lý duyệt nhanh khôi phục quyền On-chain trực tiếp trên bảng khiếu nại
  const handleVerifyFromAppeal = async (targetWallet: string) => {
    try {
      if (!window.ethereum) return;
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        contractABI.abi,
        signer
      );

      const tx = await contract.verifyIdentity(targetWallet.trim());
      await tx.wait();

      // Lưu vết vào nhật ký giao dịch ngoài chuỗi
      const newLog: DisplayTxLog = {
        id: `tx-${Date.now()}`,
        action: "Appeal Approved / Restore",
        walletOrDid: `did:lotte:${targetWallet.toLowerCase()}`,
        status: "Verified",
        txHash: tx.hash,
        time: new Date().toLocaleTimeString()
      };

      const currentLogs = [newLog, ...logs];
      setLogs(currentLogs);
      window.localStorage.setItem(PRIMARY_TX_KEY, JSON.stringify(currentLogs));

      // Xóa đơn ra khỏi Compliance List
      const updatedAppeals = appeals.filter(a => a.wallet.toLowerCase() !== targetWallet.toLowerCase());
      window.localStorage.setItem(APPEALS_KEY, JSON.stringify(updatedAppeals));
      setAppeals(updatedAppeals);
    } catch (err) {
      console.error(err);
    }
  };

  // ✅ ĐÃ THÊM: Xử lý bác bỏ khiếu nại trực tiếp trên bảng khiếu nại
  const handleRejectFromAppeal = (targetWallet: string) => {
    const newLog: DisplayTxLog = {
      id: `tx-${Date.now()}`,
      action: "Appeal Rejected / Keep Revoked",
      walletOrDid: `did:lotte:${targetWallet.toLowerCase()}`,
      status: "Revoked",
      txHash: "compliance-lock",
      time: new Date().toLocaleTimeString()
    };

    const currentLogs = [newLog, ...logs];
    setLogs(currentLogs);
    window.localStorage.setItem(PRIMARY_TX_KEY, JSON.stringify(currentLogs));

    const updatedAppeals = appeals.filter(a => a.wallet.toLowerCase() !== targetWallet.toLowerCase());
    window.localStorage.setItem(APPEALS_KEY, JSON.stringify(updatedAppeals));
    setAppeals(updatedAppeals);
  };

  function clearLogs() {
    window.localStorage.removeItem(PRIMARY_TX_KEY);
    window.localStorage.removeItem(LEGACY_TX_KEY);
    window.localStorage.removeItem("lotte_transaction_logs");
    setLogs(defaultLogs);
  }

  return (
    <main className="min-h-screen bg-[#fff8f6] text-[#151515]">
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-[#fff4f1] to-[#ffe3df]">
        <div className="absolute left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-[#E30613]/20 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[480px] w-[480px] rounded-full bg-[#E30613]/25 blur-3xl" />
        <div className="absolute right-[10%] top-28 hidden h-44 w-44 rotate-12 rounded-[3.5rem] bg-[#E30613]/10 lg:block" />

        <div className="relative mx-auto max-w-7xl px-6 py-7">
          <nav className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <Link href="/" className="group flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-[#E30613] text-3xl font-black text-white shadow-xl shadow-red-200 transition-transform group-hover:scale-105">
                L
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-[#E30613]">
                  Lotte Mall West Lake
                </p>
                <h1 className="text-xl font-black tracking-tight transition-colors group-hover:text-[#E30613] md:text-2xl">
                  {userRole === "visitor" ? "My Account History" : "System Audit Log"}
                </h1>
              </div>
            </Link>

            <div className="flex flex-wrap gap-3">
              <Link 
                href={userRole === "admin" ? "/admin" : userRole === "merchant" ? "/verify" : "/visitor"} 
                className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm transition hover:border-[#E30613] hover:text-[#E30613]"
              >
                Back to Portal
              </Link>
            </div>
          </nav>

          <div className="pb-16 pt-16">
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-red-100 bg-white/85 px-5 py-3 text-sm font-black text-[#E30613] shadow-sm">
              <span className="h-3 w-3 rounded-full bg-[#E30613]" />
              {userRole === "visitor" ? "Personal Identity Audit" : "Decentralized Governance Trail"}
            </div>

            <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
              <div>
                <h2 className="max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.055em] md:text-7xl">
                  {userRole === "visitor" ? "Trace your on-chain" : "Transaction log for"}{" "}
                  <span className="text-[#E30613]">identity actions.</span>
                </h2>

                <p className="mt-7 max-w-2xl text-lg leading-8 text-neutral-700">
                  {userRole === "visitor" 
                    ? "Below is the authenticated history of your decentralized identity interactions restricted safety to your cryptographic wallet owner address."
                    : "This page represents the comprehensive audit trail for register, verify, and revoke actions across the central infrastructure visitor identity flow."}
                </p>
              </div>

              <div className="rounded-[2rem] border border-red-100 bg-white/85 p-6 shadow-sm">
                <p className="text-sm font-black uppercase tracking-[0.28em] text-neutral-400">
                  Audit note
                </p>

                <p className="mt-3 leading-7 text-neutral-700">
                  In the full blockchain flow, each write action is linked to a
                  transaction hash. This makes identity actions traceable across
                  admin and service verification screens.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ✅ ĐÃ THÊM: Bảng tiếp nhận đơn khiếu nại (Compliance Board) được di chuyển từ Admin sang nằm trang trọng tại phân hệ này */}
      {userRole === "admin" && (
        <section className="mx-auto max-w-7xl px-6 py-6">
          <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-xl shadow-red-50 md:p-8">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">Compliance Board</p>
            <h2 className="mt-2 text-3xl font-black">Visitor Compliance Appeal Desk</h2>
            <p className="mt-2 text-sm font-semibold text-neutral-500">
              Review detailed explanations transmitted off-chain by deactivated visitor profiles contesting verification locks.
            </p>

            <div className="mt-6 overflow-hidden rounded-[2rem] border border-neutral-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-neutral-900 text-white">
                    <tr>
                      <th className="px-5 py-4 font-black">Visitor Name</th>
                      <th className="px-5 py-4 font-black">Wallet Address</th>
                      <th className="px-5 py-4 font-black">Statement Reason</th>
                      <th className="px-5 py-4 font-black">Timestamp</th>
                      <th className="px-5 py-4 font-black text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {appeals.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center font-bold text-neutral-400 bg-neutral-50/50">
                          No active identity appeal forms submitted in queue buffer.
                        </td>
                      </tr>
                    ) : (
                      appeals.map((appeal) => (
                        <tr key={appeal.id} className="transition hover:bg-[#fffaf8]">
                          <td className="px-5 py-4 font-black text-neutral-900">{appeal.name}</td>
                          <td className="px-5 py-4 font-mono text-xs font-bold text-neutral-500 break-all">{appeal.wallet}</td>
                          <td className="px-5 py-4 font-medium text-neutral-700 max-w-xs">{appeal.reason}</td>
                          <td className="px-5 py-4 font-semibold text-neutral-400">{appeal.time}</td>
                          <td className="px-5 py-4 text-center">
                            {/* Bộ đôi nút bấm đưa ra quyết định tối cao trực tiếp dành cho Admin */}
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => handleVerifyFromAppeal(appeal.wallet)}
                                className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-700 shadow-sm"
                              >
                                Restore
                              </button>
                              <button
                                onClick={() => handleRejectFromAppeal(appeal.wallet)}
                                className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-black text-neutral-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                              >
                                Revoke
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Nhật ký Audit Log hành động danh tính */}
      <section className="mx-auto max-w-7xl px-6 py-6 pb-14">
        <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-xl shadow-red-50">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">
                Log Table
              </p>

              <h2 className="mt-2 text-4xl font-black">
                Blockchain-style records
              </h2>
            </div>

            <button
              onClick={clearLogs}
              className="rounded-2xl bg-[#111] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#E30613]"
            >
              Clear Demo Logs
            </button>
          </div>

          <div className="mt-6 overflow-hidden rounded-[2rem] border border-neutral-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse bg-white text-left text-sm">
                <thead className="bg-[#E30613] text-white">
                  <tr>
                    <th className="px-5 py-4 font-black">Action</th>
                    <th className="px-5 py-4 font-black">Wallet / DID</th>
                    <th className="px-5 py-4 font-black">Status</th>
                    <th className="px-5 py-4 font-black">Tx Hash</th>
                    <th className="px-5 py-4 font-black">Time</th>
                  </tr>
                </thead>

                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-t border-neutral-100 transition hover:bg-[#fffaf8]"
                    >
                      <td className="px-5 py-4 font-black">{log.action}</td>

                      <td className="max-w-[260px] px-5 py-4 font-semibold text-neutral-600">
                        <span title={log.walletOrDid}>
                          {truncateMiddle(log.walletOrDid, 18, 10)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 font-black ${getStatusClass(
                            log.status,
                          )}`}
                        >
                          {log.status}
                        </span>
                      </td>

                      <td className="max-w-[260px] px-5 py-4 font-mono text-xs text-neutral-500">
                        <span title={log.txHash}>
                          {truncateMiddle(log.txHash, 18, 12)}
                        </span>
                      </td>

                      <td className="px-5 py-4 font-semibold text-neutral-600">
                        {log.time}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <SummaryCard
              number={actionCounts.register}
              title="Register"
              description="Admin creates and registers visitor identity."
            />
            <SummaryCard
              number={actionCounts.verify}
              title="Verify"
              description="Merchant checks DID or wallet status."
            />
            <SummaryCard
              number={actionCounts.revoke}
              title="Revoke"
              description="Admin cancels identity validity when needed."
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.5rem] bg-[#fff4f1] p-5">
      <p className="text-sm font-black uppercase tracking-[0.28em] text-[#E30613]">
        {String(number).padStart(2, "0")}
      </p>
      <h3 className="mt-3 text-xl font-black">{title}</h3>
      <p className="mt-3 leading-7 text-neutral-600">{description}</p>
    </div>
  );
}