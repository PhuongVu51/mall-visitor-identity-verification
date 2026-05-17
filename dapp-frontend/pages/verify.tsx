import { useEffect, useState } from "react";
import Link from "next/link";

type IdentityStatus = "Not Registered" | "Pending" | "Verified" | "Revoked";

type StoredIdentity = {
  did: string;
  walletAddress: string;
  identityHash: string;
  status: IdentityStatus;
  accessLevel: string[];
  visitorName: string;
  visitorType: string;
  issuedAt: string;
};

type TxLog = {
  action: string;
  did: string;
  status: string;
  txHash: string;
  time: string;
};

const TX_KEY = "lotte_tx_logs";
const IDENTITY_KEY = "lotte_visitor_identity";

function makeTxHash() {
  const chars = "abcdef0123456789";
  let value = "0x";
  for (let index = 0; index < 64; index += 1) value += chars[Math.floor(Math.random() * chars.length)];
  return value;
}

function saveTxLog(log: TxLog) {
  const saved = window.localStorage.getItem(TX_KEY);
  const currentLogs = saved ? (JSON.parse(saved) as TxLog[]) : [];
  window.localStorage.setItem(TX_KEY, JSON.stringify([log, ...currentLogs]));
}

export default function VerifyPage() {
  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [result, setResult] = useState<"idle" | "verified" | "denied">("idle");
  const [message, setMessage] = useState("Enter visitor DID or wallet address to verify.");

  useEffect(() => {
    const savedIdentity = window.localStorage.getItem(IDENTITY_KEY);

    if (savedIdentity) {
      try {
        const parsed = JSON.parse(savedIdentity) as StoredIdentity;
        setIdentity(parsed);
      } catch {
        window.localStorage.removeItem(IDENTITY_KEY);
      }
    }
  }, []);

  function useCurrentIdentity() {
    if (!identity) {
      setMessage("No registered visitor identity found.");
      return;
    }

    setInputValue(identity.did);
    setMessage("Current visitor DID has been inserted.");
  }

  function verifyVisitor() {
    if (!identity) {
      setResult("denied");
      setMessage("No visitor identity is registered in this browser.");
      return;
    }

    const normalized = inputValue.trim().toLowerCase();
    const matchDid = normalized === identity.did.toLowerCase();
    const matchWallet = normalized === identity.walletAddress.toLowerCase();

    if ((matchDid || matchWallet) && identity.status === "Verified") {
      const log: TxLog = {
        action: "Verify Identity",
        did: identity.did,
        status: "Verified",
        txHash: makeTxHash(),
        time: new Date().toLocaleTimeString(),
      };

      saveTxLog(log);
      setResult("verified");
      setMessage("Identity verified. Access granted.");
      return;
    }

    const log: TxLog = {
      action: "Verify Identity",
      did: inputValue || "empty-input",
      status: "Denied",
      txHash: makeTxHash(),
      time: new Date().toLocaleTimeString(),
    };

    saveTxLog(log);
    setResult("denied");
    setMessage("Identity not verified. Access denied.");
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
                  Verification Portal
                </h1>
              </div>
            </Link>

            <div className="flex flex-wrap gap-3">
              <NavLink href="/">Home</NavLink>
              <NavLink href="/visitor">Visitor Wallet</NavLink>
              <NavLink href="/admin">Admin Portal</NavLink>
              <NavLink href="/transactions">Transactions</NavLink>
            </div>
          </nav>

          <div className="grid gap-10 pb-16 pt-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-red-100 bg-white/85 px-5 py-3 text-sm font-black text-[#E30613] shadow-sm">
                <span className="h-3 w-3 rounded-full bg-[#E30613]" />
                Merchant / Event Desk / Parking
              </div>

              <h2 className="text-5xl font-black leading-[0.98] tracking-[-0.055em] md:text-7xl">
                Verify visitor access{" "}
                <span className="text-[#E30613]">without seeing private data.</span>
              </h2>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-neutral-700">
                Service counters can check the visitor DID or wallet address and
                receive only the verification result. Phone number and email are
                not exposed to merchants.
              </p>

              <div className="mt-8 rounded-[1.75rem] border border-red-100 bg-white/85 p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-400">
                  Verification message
                </p>
                <p className="mt-2 font-bold text-neutral-900">{message}</p>
              </div>
            </div>

            <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-2xl shadow-red-100">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">
                Check Visitor
              </p>
              <h3 className="mt-2 text-3xl font-black">DID / Wallet Lookup</h3>

              <label className="mt-6 block">
                <span className="text-sm font-black text-neutral-700">
                  Enter DID or Wallet Address
                </span>
                <input
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  placeholder="did:lotte:0x... or 0x..."
                  className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-semibold outline-none transition focus:border-[#E30613] focus:ring-4 focus:ring-red-100"
                />
              </label>

              <div className="mt-5 flex flex-wrap gap-3">
                <button onClick={useCurrentIdentity} className="rounded-2xl border border-red-200 bg-white px-5 py-3 font-black text-[#E30613] transition hover:-translate-y-0.5 hover:shadow-md">
                  Use Current DID
                </button>
                <button onClick={verifyVisitor} className="rounded-2xl bg-[#E30613] px-5 py-3 font-black text-white shadow-xl shadow-red-100 transition hover:-translate-y-0.5">
                  Verify Visitor
                </button>
              </div>

              <div
                className={`mt-6 rounded-[2rem] border p-6 ${
                  result === "verified"
                    ? "border-green-200 bg-green-50 text-green-800"
                    : result === "denied"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-neutral-200 bg-neutral-50 text-neutral-700"
                }`}
              >
                <p className="text-sm font-black uppercase tracking-[0.28em]">
                  Result
                </p>
                <h3 className="mt-3 text-3xl font-black">
                  {result === "verified"
                    ? "Access Granted"
                    : result === "denied"
                      ? "Access Denied"
                      : "Waiting for Check"}
                </h3>
                <p className="mt-3 text-sm font-semibold">
                  {result === "verified"
                    ? "The visitor identity is verified and active."
                    : result === "denied"
                      ? "The identity is not verified, does not match, or has been revoked."
                      : "Enter DID or wallet address to verify visitor status."}
                </p>
              </div>
            </div>
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