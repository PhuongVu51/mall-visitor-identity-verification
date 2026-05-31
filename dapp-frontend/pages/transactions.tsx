import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import contractABI from "../constants/contractABI.json";

const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const PRIMARY_TX_KEY = "lotte_transaction_logs";
const LEGACY_TX_KEY = "lotte_tx_logs";
const APPEALS_KEY = "lotte_admin_appeals";

type TxLog = { id?: string; action: string; did?: string; walletOrDid?: string; wallet?: string; status: string; txHash: string; time: string; };
type DisplayTxLog = { id: string; action: string; walletOrDid: string; status: string; txHash: string; time: string; };
type UserSession = { role: "visitor" | "admin" | "merchant"; name: string; email: string; };
type AppealTicket = { id: string; wallet: string; name: string; reason: string; time: string; };

const defaultLogs: DisplayTxLog[] = [{ id: "system-ready", action: "System Ready", walletOrDid: "did:lotte:demo", status: "Ready", txHash: "0x0000000000000000000000000000000000000000000000000000000000000001", time: "Demo start" }];

function normalizeLog(log: TxLog, index: number): DisplayTxLog {
  return { id: log.id ?? `${log.txHash}-${log.time}-${index}`, action: log.action, walletOrDid: log.walletOrDid ?? log.wallet ?? log.did ?? "Not available", status: log.status, txHash: log.txHash, time: log.time };
}

function safeParseLogs(value: string | null): DisplayTxLog[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is TxLog => {
      if (typeof item !== "object" || item === null) return false;
      const log = item as Partial<TxLog>;
      return typeof log.action === "string" && typeof log.status === "string" && typeof log.txHash === "string" && typeof log.time === "string";
    }).map(normalizeLog);
  } catch { return []; }
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
    return logs.reduce((acc, log) => {
      const action = log.action.toLowerCase();
      if (action.includes("register")) acc.register += 1;
      if (action.includes("verify")) acc.verify += 1;
      if (action.includes("revoke")) acc.revoke += 1;
      return acc;
    }, { register: 0, verify: 0, revoke: 0 });
  }, [logs]);

  const loadAppealsData = () => {
    try {
      const raw = window.localStorage.getItem(APPEALS_KEY);
      if (raw) setAppeals(JSON.parse(raw) as AppealTicket[]);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const rawUser = window.localStorage.getItem("lotte_web2_user");
    const activeWallet = window.localStorage.getItem("lotte_wallet_address") || "";
    if (rawUser) { try { setUserRole((JSON.parse(rawUser) as UserSession).role); } catch (e) { console.error(e); } }
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
      } else { setLogs(uniqueLogs); }
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

      const newLog: DisplayTxLog = { id: `tx-${Date.now()}`, action: "Appeal Approved / Restore", walletOrDid: `did:lotte:${targetWallet.toLowerCase()}`, status: "Verified", txHash: tx.hash, time: new Date().toLocaleTimeString() };
      const currentLogs = [newLog, ...logs];
      setLogs(currentLogs);
      window.localStorage.setItem(PRIMARY_TX_KEY, JSON.stringify(currentLogs));
      const updatedAppeals = appeals.filter(a => a.wallet.toLowerCase() !== targetWallet.toLowerCase());
      window.localStorage.setItem(APPEALS_KEY, JSON.stringify(updatedAppeals));
      setAppeals(updatedAppeals);
      alert("✅ khôi phục danh tính khách hàng thành công!");
    } catch (err) { console.error(err); }
  };

  const handleRejectFromAppeal = (targetWallet: string) => {
    const newLog: DisplayTxLog = { id: `tx-${Date.now()}`, action: "Appeal Rejected / Keep Revoked", walletOrDid: `did:lotte:${targetWallet.toLowerCase()}`, status: "Revoked", txHash: "compliance-lock", time: new Date().toLocaleTimeString() };
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
    <main className="min-h-screen text-[#151515] relative overflow-hidden" style={{ background: "radial-gradient(circle at 0% 0%, rgba(227, 6, 19, 0.14), transparent 32%), radial-gradient(circle at 95% 100%, rgba(227, 6, 19, 0.22), transparent 34%), linear-gradient(135deg, #fff8f6 0%, #fffdfc 48%, #fff0ee 100%)" }}>
      <div className="pointer-events-none absolute -left-44 -top-44 z-0 h-[460px] w-[460px] rounded-full bg-[#E30613]/15 blur-3xl"></div>
      <div className="pointer-events-none absolute -bottom-48 -right-40 z-0 h-[560px] w-[560px] rounded-full bg-[#E30613]/20 blur-3xl"></div>
      <div className="pointer-events-none absolute right-[8%] top-28 z-0 hidden h-44 w-44 rotate-12 rounded-[3.5rem] bg-[#E30613]/10 lg:block"></div>

      <section className="relative z-10 mx-auto max-w-[1180px] px-8 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[1.3rem] bg-white shadow-xl shadow-red-100">
              <img src="/lotte%20mall.png" alt="Lotte Mall" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.42em] text-[#E30613]">Lotte Mall West Lake</p>
              <h1 className="text-2xl font-black tracking-tight">{userRole === "visitor" ? "My Account History" : "Audit History"}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href={userRole === "admin" ? "/admin" : userRole === "merchant" ? "/verify" : "/visitor"} className="rounded-full border border-red-100 bg-white/90 px-5 py-3 text-sm font-black shadow-sm">Back to Portal</Link>
            <button className="rounded-full border border-neutral-200 bg-neutral-100 px-5 py-3 text-sm font-black text-neutral-500 shadow-sm" onClick={() => {window.localStorage.removeItem("lotte_web2_user"); window.location.href="/";}}>Logout</button>
          </div>
        </header>

        <section className="mb-8 grid gap-7 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
          <div>
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-red-100 bg-white/85 px-5 py-3 text-sm font-black text-[#E30613] shadow-sm">
              <span className="h-3 w-3 rounded-full bg-[#E30613]"></span>Filtered Audit Trail
            </div>
            <h2 className="max-w-[620px] text-6xl font-black leading-[0.92] tracking-[-0.07em]">System <span className="text-[#E30613]">check-in log.</span></h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[2rem] border border-green-100 bg-green-50/80 p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-400">Total Logs</p>
              <p className="mt-3 text-4xl font-black text-green-800">{logs.length}</p>
            </div>
            <div className="rounded-[2rem] border border-blue-100 bg-blue-50/80 p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-400">Registers</p>
              <p className="mt-3 text-4xl font-black text-blue-700">{actionCounts.register}</p>
            </div>
            <div className="rounded-[2rem] border border-red-100 bg-white/90 p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-400">Visitor Data</p>
              <p className="mt-3 text-2xl font-black">Masked</p>
              <p className="mt-2 text-sm font-black text-[#E30613]">Raw PII hidden</p>
            </div>
          </div>
        </section>

        {userRole === "admin" && (
          <div className="mb-8 rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-xl shadow-red-50 md:p-8">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">Compliance Board</p>
            <h2 className="mt-2 text-3xl font-black">Visitor Compliance Appeal Desk</h2>
            <div className="mt-6 overflow-hidden rounded-[2rem] border border-neutral-200 bg-white">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-neutral-900 text-white">
                  <tr><th className="px-5 py-4 font-black">Name</th><th className="px-5 py-4 font-black">Wallet Address</th><th className="px-5 py-4 font-black">Reason</th><th className="px-5 py-4 font-black">Time</th><th className="px-5 py-4 font-black text-center">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {appeals.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-8 text-center font-bold text-neutral-400 bg-neutral-50/50">No active identity appeal forms submitted.</td></tr>
                  ) : (
                    appeals.map((appeal) => (
                      <tr key={appeal.id} className="transition hover:bg-[#fffaf8]">
                        <td className="px-5 py-4 font-black text-neutral-900">{appeal.name}</td>
                        <td className="px-5 py-4 font-mono text-xs font-bold text-neutral-500 break-all">{appeal.wallet}</td>
                        <td className="px-5 py-4 font-medium text-neutral-700 max-w-xs">{appeal.reason}</td>
                        <td className="px-5 py-4 font-semibold text-neutral-400">{appeal.time}</td>
                        <td className="px-5 py-4 text-center flex gap-2 justify-center">
                          <button onClick={() => handleVerifyFromAppeal(appeal.wallet)} className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-700 shadow-sm">Restore</button>
                          <button onClick={() => handleRejectFromAppeal(appeal.wallet)} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-black text-neutral-500 hover:bg-red-50 hover:text-red-600">Revoke</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <section className="rounded-[2.7rem] border border-red-100 bg-white/92 p-7 shadow-2xl shadow-red-100">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.35em] text-[#E30613]">Audit Records</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight">Visitor-to-merchant actions.</h2>
            </div>
            <button onClick={clearLogs} className="rounded-2xl bg-[#111] px-6 py-4 text-sm font-black text-white shadow-md">Clear Demo Logs</button>
          </div>
          <div className="mt-6 overflow-hidden rounded-[2rem] border border-red-100">
            <table className="w-full border-collapse text-left text-sm bg-white">
              <thead className="bg-[#E30613] text-white">
                <tr><th className="px-5 py-4 font-black">Action</th><th className="px-5 py-4 font-black">Masked DID / Wallet</th><th className="px-5 py-4 font-black">Result</th><th className="px-5 py-4 font-black">Tx Hash</th><th className="px-5 py-4 font-black">Time</th></tr>
              </thead>
              <tbody className="divide-y divide-red-50">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-5 py-4 font-black">{log.action}</td>
                    <td className="px-5 py-4 font-mono text-xs font-bold text-neutral-600">{truncateMiddle(log.walletOrDid, 16, 8)}</td>
                    <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${log.status.includes('Success') || log.status.includes('Verified') ? 'bg-green-100 text-green-700' : log.status.includes('Denied') || log.status.includes('Revoked') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{log.status}</span></td>
                    <td className="px-5 py-4 font-mono text-xs">{truncateMiddle(log.txHash, 14, 8)}</td>
                    <td className="px-5 py-4 font-semibold text-neutral-600">{log.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}