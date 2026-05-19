import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type TxLog = {
  id?: string;
  action: string;
  did?: string;
  walletOrDid?: string;
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

const PRIMARY_TX_KEY = "lotte_transaction_logs";
const LEGACY_TX_KEY = "lotte_tx_logs";

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
    walletOrDid: log.walletOrDid ?? log.did ?? "Not available",
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
          typeof log.time === "string" &&
          (typeof log.walletOrDid === "string" || typeof log.did === "string")
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

  useEffect(() => {
    const primaryLogs = safeParseLogs(
      window.localStorage.getItem(PRIMARY_TX_KEY),
    );

    const legacyLogs = safeParseLogs(window.localStorage.getItem(LEGACY_TX_KEY));

    const mergedLogs = [...primaryLogs, ...legacyLogs];

    if (mergedLogs.length > 0) {
      setLogs(mergedLogs);
      window.localStorage.setItem(PRIMARY_TX_KEY, JSON.stringify(mergedLogs));
      return;
    }

    setLogs(defaultLogs);
  }, []);

  function clearLogs() {
    window.localStorage.removeItem(PRIMARY_TX_KEY);
    window.localStorage.removeItem(LEGACY_TX_KEY);
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
                <h2 className="max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.055em] md:text-7xl">
                  Transaction log for{" "}
                  <span className="text-[#E30613]">identity actions.</span>
                </h2>

                <p className="mt-7 max-w-2xl text-lg leading-8 text-neutral-700">
                  This page represents the audit trail for register, verify, and
                  revoke actions across the visitor identity flow.
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

      <section className="mx-auto max-w-7xl px-6 py-14">
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

function NavLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm transition hover:-translate-y-0.5 hover:border-[#E30613] hover:text-[#E30613]"
    >
      {children}
    </Link>
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