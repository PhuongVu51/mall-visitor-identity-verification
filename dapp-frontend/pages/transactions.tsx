import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import contractABI from "../constants/contractABI.json";

const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const PRIMARY_TX_KEY = "lotte_transaction_logs";
const LEGACY_TX_KEY = "lotte_tx_logs";
const APPEALS_KEY = "lotte_admin_appeals";

type TxLog = {
  id?: string;
  action: string;
  did?: string;
  walletOrDid?: string;
  wallet?: string;
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

type AppealTicket = {
  id: string;
  wallet: string;
  name: string;
  reason: string;
  time: string;
};

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
  if (normalized.includes("pending") || normalized.includes("flagged")) {
    return "bg-yellow-50 text-yellow-700 border-yellow-100";
  }
  if (normalized.includes("revoked") || normalized.includes("denied")) {
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
  const [userRole, setUserRole] = useState<string>("visitor");
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
      { register: 0, verify: 0, revoke: 0 },
    );
  }, [logs]);

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
    const rawUser = window.localStorage.getItem("lotte_web2_user");
    const activeWallet = window.localStorage.getItem("lotte_wallet_address") || "";

    if (rawUser) {
      try {
        const parsedUser = JSON.parse(rawUser) as UserSession;
        setUserRole(parsedUser.role);
      } catch (e) {
        console.error(e);
      }
    }

    loadAppealsData();

    const primaryLogs = safeParseLogs(window.localStorage.getItem(PRIMARY_TX_KEY));
    const legacyLogs = safeParseLogs(window.localStorage.getItem(LEGACY_TX_KEY));
    const secondaryLogs = safeParseLogs(window.localStorage.getItem("lotte_transaction_logs"));
    
    const mergedLogs = [...primaryLogs, ...legacyLogs, ...secondaryLogs];
    const uniqueLogsMap = new Map<string, DisplayTxLog>();
    mergedLogs.forEach(log => uniqueLogsMap.set(log.id, log));
    const uniqueLogs = Array.from(uniqueLogsMap.values());

    if (uniqueLogs.length > 0) {
      if (window.localStorage.getItem("lotte_web2_user") && JSON.parse(window.localStorage.getItem("lotte_web2_user")!).role === "visitor") {
        setLogs(uniqueLogs.filter(log => log.walletOrDid.toLowerCase().includes(activeWallet.toLowerCase())));
      } else {
        setLogs(uniqueLogs);
      }
      window.localStorage.setItem(PRIMARY_TX_KEY, JSON.stringify(uniqueLogs));
      return;
    }
    setLogs(defaultLogs);
  }, []);

  const handleVerifyFromAppeal = async (targetWallet: string) => {
    try {
      if (!window.ethereum) return;
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, contractABI.abi, signer);

      const tx = await contract.verifyIdentity(targetWallet.trim());
      await tx.wait();

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

      const updatedAppeals = appeals.filter(a => a.wallet.toLowerCase() !== targetWallet.toLowerCase());
      window.localStorage.setItem(APPEALS_KEY, JSON.stringify(updatedAppeals));
      setAppeals(updatedAppeals);
      alert("✅ khôi phục danh tính khách hàng thành công!");
    } catch (err) {
      console.error(err);
    }
  };

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
    alert("🚫 Từ chối khiếu nại thành công.");
  };

  function clearLogs() {
    window.localStorage.removeItem(PRIMARY_TX_KEY);
    window.localStorage.removeItem(LEGACY_TX_KEY);
    window.localStorage.removeItem("lotte_transaction_logs");
    setLogs(defaultLogs);
  }

  return (
    <main className="min-h-screen bg-[#fff8f6] text-[#151515]">
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-[#fff4f1] to-[#ffe3df] py-7">
        <div className="mx-auto max-w-7xl px-6 flex justify-between items-center border-b pb-4">
          <Link href="/" className="group flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-[#E30613] text-3xl font-black text-white shadow-xl shadow-red-200">L</div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#E30613]">Lotte Mall West Lake</p>
              <h1 className="text-xl font-black tracking-tight md:text-2xl">{userRole === "visitor" ? "My Account History" : "System Audit Log"}</h1>
            </div>
          </Link>
          <Link href={userRole === "admin" ? "/admin" : userRole === "merchant" ? "/verify" : "/visitor"} className="text-sm font-black bg-white border px-5 py-2.5 rounded-full shadow-sm">Back to Portal</Link>
        </div>

        {userRole === "admin" && (
          <div className="mx-auto max-w-7xl px-6 mt-6">
            <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-xl shadow-red-50 md:p-8">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">Compliance Board</p>
              <h2 className="mt-2 text-3xl font-black">Visitor Compliance Appeal Desk</h2>
              <div className="mt-6 overflow-hidden rounded-[2rem] border border-neutral-200 bg-white">
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
                      <tr><td colSpan={5} className="px-5 py-8 text-center font-bold text-neutral-400 bg-neutral-50/50">No active identity appeal forms submitted in queue buffer.</td></tr>
                    ) : (
                      appeals.map((appeal) => (
                        <tr key={appeal.id} className="transition hover:bg-[#fffaf8]">
                          <td className="px-5 py-4 font-black text-neutral-900">{appeal.name}</td>
                          <td className="px-5 py-4 font-mono text-xs font-bold text-neutral-500 break-all">{appeal.wallet}</td>
                          <td className="px-5 py-4 font-medium text-neutral-700 max-w-xs">{appeal.reason}</td>
                          <td className="px-5 py-4 font-semibold text-neutral-400">{appeal.time}</td>
                          <td className="px-5 py-4 text-center">
                            <div className="flex gap-2 justify-center">
                              <button onClick={() => handleVerifyFromAppeal(appeal.wallet)} className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-700 shadow-sm">Restore</button>
                              <button onClick={() => handleRejectFromAppeal(appeal.wallet)} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-black text-neutral-500 hover:bg-red-50 hover:text-red-600">Revoke</button>
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
        )}

        <div className="mx-auto max-w-7xl px-6 mt-8 rounded-[2.5rem] border bg-white shadow-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black">Blockchain-style records</h2>
            <button onClick={clearLogs} className="rounded-2xl bg-neutral-950 px-5 py-2.5 text-sm font-black text-white hover:bg-[#E30613]">Clear Demo Logs</button>
          </div>
          <div className="overflow-x-auto rounded-[2rem] border">
            <table className="w-full border-collapse text-left text-sm bg-white">
              <thead className="bg-[#E30613] text-white">
                <tr>
                  <th className="px-5 py-4 font-black">Action Event</th>
                  <th className="px-5 py-4 font-black">Wallet / DID</th>
                  <th className="px-5 py-4 font-black">Status</th>
                  <th className="px-5 py-4 font-black">Tx Hash Matrix</th>
                  <th className="px-5 py-4 font-black">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t hover:bg-neutral-50">
                    <td className="px-5 py-4 font-black text-neutral-900">{log.action}</td>
                    <td className="px-5 py-4 font-mono text-xs text-neutral-600">{truncateMiddle(log.walletOrDid, 16, 8)}</td>
                    <td className="px-5 py-4"><span className={`rounded-full border px-3 py-0.5 text-xs font-black ${getStatusClass(log.status)}`}>{log.status}</span></td>
                    <td className="px-5 py-4 font-mono text-xs text-neutral-400">{truncateMiddle(log.txHash, 14, 8)}</td>
                    <td className="px-5 py-4 font-semibold text-neutral-500">{log.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <SummaryCard number={actionCounts.register} title="Register" description="Admin creates and registers visitor identity." />
            <SummaryCard number={actionCounts.verify} title="Verify" description="Merchant checks DID or wallet status." />
            <SummaryCard number={actionCounts.revoke} title="Revoke" description="Admin cancels identity validity when needed." />
          </div>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="rounded-[1.5rem] bg-[#fff4f1] p-5">
      <p className="text-sm font-black uppercase text-[#E30613]">{String(number).padStart(2, "0")}</p>
      <h3 className="mt-3 text-xl font-black">{title}</h3>
      <p className="mt-2 text-xs text-neutral-500 leading-relaxed">{description}</p>
    </div>
  );
}