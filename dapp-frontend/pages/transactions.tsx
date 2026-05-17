import { useEffect, useState } from "react";
import Link from "next/link";

type TxLog = {
  action: string;
  did: string;
  status: string;
  txHash: string;
  time: string;
};

const TX_KEY = "lotte_tx_logs";

const defaultLogs: TxLog[] = [
  {
    action: "System Ready",
    did: "did:lotte:demo",
    status: "Ready",
    txHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
    time: "Demo start",
  },
];

export default function TransactionsPage() {
  const [logs, setLogs] = useState<TxLog[]>(defaultLogs);

  useEffect(() => {
    const saved = window.localStorage.getItem(TX_KEY);

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as TxLog[];
        setLogs(parsed.length > 0 ? parsed : defaultLogs);
      } catch {
        window.localStorage.removeItem(TX_KEY);
      }
    }
  }, []);

  function clearLogs() {
    window.localStorage.removeItem(TX_KEY);
    setLogs(defaultLogs);
  }

  return (
    <main className="min-h-screen bg-[#fff8f6] text-[#151515]">
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-[#fff4f1] to-[#ffe3df]">
        <div className="absolute left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-[#E30613]/20 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[480px] w-[480px] rounded-full bg-[#E30613]/25 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 py-7">
          <nav className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <Link href="/" className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-[#E30613] text-3xl font-black text-white shadow-xl shadow-red-200">
                L
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-[#E30613]">
                  Lotte Mall West Lake
                </p>
                <h1 className="text-xl font-black tracking-tight md:text-2xl">
                  Transaction History
                </h1>
              </div>
            </Link>

            <div className="flex flex-wrap gap-3">
              <NavLink href="/">Home</NavLink>
              <NavLink href="/visitor">Visitor Wallet</NavLink>
              <NavLink href="/admin">Admin Portal</NavLink>
              <NavLink href="/verify">Verify</NavLink>
            </div>
          </nav>

          <div className="pb-16 pt-16">
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-red-100 bg-white/85 px-5 py-3 text-sm font-black text-[#E30613] shadow-sm">
              <span className="h-3 w-3 rounded-full bg-[#E30613]" />
              Blockchain Audit Trail
            </div>

            <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
              <div>
                <h2 className="text-5xl font-black leading-[0.98] tracking-[-0.055em] md:text-7xl">
                  Transaction log for{" "}
                  <span className="text-[#E30613]">identity actions.</span>
                </h2>
                <p className="mt-7 max-w-2xl text-lg leading-8 text-neutral-700">
                  This page records register, verify, and revoke actions. In the
                  full smart contract version, these records correspond to real
                  blockchain transaction hashes.
                </p>
              </div>

              <div className="rounded-[2rem] border border-red-100 bg-white/85 p-6 shadow-sm">
                <p className="text-sm font-black uppercase tracking-[0.28em] text-neutral-400">
                  Demo note
                </p>
                <p className="mt-3 leading-7 text-neutral-700">
                  The frontend prototype simulates transaction hashes for
                  presentation. The concept remains the same: blockchain provides
                  an auditable history shared across parties.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-xl shadow-red-50">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">
                Log Table
              </p>
              <h2 className="mt-2 text-4xl font-black">Blockchain-style records</h2>
            </div>

            <button onClick={clearLogs} className="rounded-2xl bg-[#111] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5">
              Clear Demo Logs
            </button>
          </div>

          <div className="mt-6 overflow-hidden rounded-[2rem] border border-neutral-200">
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
                  <tr key={`${log.txHash}-${log.time}`} className="border-t border-neutral-100">
                    <td className="px-5 py-4 font-black">{log.action}</td>
                    <td className="max-w-[260px] truncate px-5 py-4 font-semibold text-neutral-600">
                      {log.did}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-[#fff4f1] px-3 py-1 font-black text-[#E30613]">
                        {log.status}
                      </span>
                    </td>
                    <td className="max-w-[260px] truncate px-5 py-4 font-mono text-xs text-neutral-500">
                      {log.txHash}
                    </td>
                    <td className="px-5 py-4 font-semibold text-neutral-600">
                      {log.time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <SummaryCard title="Register" description="Admin creates visitor identity hash and verifies DID." />
            <SummaryCard title="Verify" description="Merchant checks DID/wallet status before granting access." />
            <SummaryCard title="Revoke" description="Admin cancels identity validity if the visitor is no longer trusted." />
          </div>
        </div>
      </section>
    </main>
  );
}

function NavLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm transition hover:-translate-y-0.5 hover:border-[#E30613] hover:text-[#E30613]">
      {children}
    </Link>
  );
}

function SummaryCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[1.5rem] bg-[#fff4f1] p-5">
      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-3 leading-7 text-neutral-600">{description}</p>
    </div>
  );
}