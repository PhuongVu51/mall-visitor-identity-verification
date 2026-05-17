import { useEffect, useMemo, useState } from "react";
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

type AdminForm = {
  visitorName: string;
  phone: string;
  email: string;
  walletAddress: string;
  visitorType: string;
};

const TX_KEY = "lotte_tx_logs";
const IDENTITY_KEY = "lotte_visitor_identity";
const WALLET_KEY = "lotte_wallet_address";

function makeDid(address: string) {
  if (!address) return "did:lotte:not-connected";
  return `did:lotte:${address}`;
}

function shortenAddress(address: string) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function makeTxHash() {
  const chars = "abcdef0123456789";
  let value = "0x";
  for (let index = 0; index < 64; index += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
}

async function sha256Hex(value: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(buffer));

  return `0x${bytes.map((item) => item.toString(16).padStart(2, "0")).join("")}`;
}

function saveTxLog(log: TxLog) {
  const saved = window.localStorage.getItem(TX_KEY);
  const currentLogs = saved ? (JSON.parse(saved) as TxLog[]) : [];
  window.localStorage.setItem(TX_KEY, JSON.stringify([log, ...currentLogs]));
}

export default function AdminPage() {
  const [form, setForm] = useState<AdminForm>({
    visitorName: "Nguyen Minh Thuy",
    phone: "0912345678",
    email: "visitor.demo@lotte.vn",
    walletAddress: "",
    visitorType: "Event Visitor",
  });

  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const [message, setMessage] = useState("Admin can register or revoke visitor identity.");
  const [revokeReason, setRevokeReason] = useState("Incorrect or suspicious visitor information.");

  const did = useMemo(() => makeDid(form.walletAddress), [form.walletAddress]);

  useEffect(() => {
    const savedWallet = window.localStorage.getItem(WALLET_KEY);
    const savedIdentity = window.localStorage.getItem(IDENTITY_KEY);

    if (savedWallet) {
      setForm((current) => ({ ...current, walletAddress: savedWallet }));
    }

    if (savedIdentity) {
      try {
        const parsed = JSON.parse(savedIdentity) as StoredIdentity;
        setIdentity(parsed);
        setForm((current) => ({
          ...current,
          visitorName: parsed.visitorName,
          walletAddress: parsed.walletAddress,
          visitorType: parsed.visitorType,
        }));
      } catch {
        window.localStorage.removeItem(IDENTITY_KEY);
      }
    }
  }, []);

  async function generateIdentityHash(status: IdentityStatus = "Pending") {
    if (!form.walletAddress.trim()) {
      setMessage("Please enter or connect a wallet address first.");
      return null;
    }

    const rawData = [
      form.visitorName,
      form.phone,
      form.email,
      form.walletAddress,
      form.visitorType,
    ].join("|");

    const identityHash = await sha256Hex(rawData);

    const generatedIdentity: StoredIdentity = {
      did,
      walletAddress: form.walletAddress,
      identityHash,
      status,
      accessLevel: ["Parking", "Event Desk", "Merchant Check"],
      visitorName: form.visitorName,
      visitorType: form.visitorType,
      issuedAt: new Date().toLocaleString(),
    };

    setIdentity(generatedIdentity);
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(generatedIdentity));
    setMessage("Identity hash generated. Personal data is represented as a hash.");

    return generatedIdentity;
  }

  async function registerIdentity() {
    const generated = identity ?? (await generateIdentityHash("Pending"));

    if (!generated) return;

    const verifiedIdentity: StoredIdentity = {
      ...generated,
      status: "Verified",
      issuedAt: generated.issuedAt || new Date().toLocaleString(),
    };

    setIdentity(verifiedIdentity);
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(verifiedIdentity));

    const log: TxLog = {
      action: "Register Identity",
      did: verifiedIdentity.did,
      status: "Success",
      txHash: makeTxHash(),
      time: new Date().toLocaleTimeString(),
    };

    saveTxLog(log);
    setMessage("Visitor identity registered and verified successfully.");
  }

  function revokeIdentity() {
    if (!identity) {
      setMessage("No visitor identity found to revoke.");
      return;
    }

    const revokedIdentity: StoredIdentity = {
      ...identity,
      status: "Revoked",
    };

    setIdentity(revokedIdentity);
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(revokedIdentity));

    const log: TxLog = {
      action: "Revoke Identity",
      did: revokedIdentity.did,
      status: "Revoked",
      txHash: makeTxHash(),
      time: new Date().toLocaleTimeString(),
    };

    saveTxLog(log);
    setMessage(`Identity revoked. Reason: ${revokeReason}`);
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
                  Admin Portal
                </h1>
              </div>
            </Link>

            <div className="flex flex-wrap gap-3">
              <NavLink href="/">Home</NavLink>
              <NavLink href="/visitor">Visitor Wallet</NavLink>
              <NavLink href="/verify">Verify</NavLink>
              <NavLink href="/transactions">Transactions</NavLink>
            </div>
          </nav>

          <div className="grid gap-10 pb-16 pt-16 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-red-100 bg-white/85 px-5 py-3 text-sm font-black text-[#E30613] shadow-sm">
                <span className="h-3 w-3 rounded-full bg-[#E30613]" />
                Lotte Mall Admin
              </div>

              <h2 className="text-5xl font-black leading-[0.98] tracking-[-0.055em] md:text-7xl">
                Register visitor identity{" "}
                <span className="text-[#E30613]">without storing raw data.</span>
              </h2>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-neutral-700">
                Admin enters visitor information, generates an identity hash, and
                verifies the DID for mall-wide services. Revoke means cancelling
                the validity of an identity when it is no longer trusted.
              </p>

              <div className="mt-8 rounded-[1.75rem] border border-red-100 bg-white/85 p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-400">
                  Admin status
                </p>
                <p className="mt-2 font-bold text-neutral-900">{message}</p>
              </div>
            </div>

            <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-2xl shadow-red-100">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">
                Current Identity
              </p>
              <h3 className="mt-2 text-3xl font-black">
                {identity ? identity.status : "Not Registered"}
              </h3>

              <div className="mt-6 space-y-4 rounded-[2rem] bg-[#111] p-6 text-white">
                <InfoRow label="DID" value={identity?.did ?? did} />
                <InfoRow label="Wallet" value={shortenAddress(identity?.walletAddress ?? form.walletAddress)} />
                <InfoRow label="Identity Hash" value={identity?.identityHash ?? "Generate hash first"} />
                <InfoRow label="Issued At" value={identity?.issuedAt ?? "Not issued"} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">
            Register Identity
          </p>
          <h2 className="mt-2 text-4xl font-black">Visitor information</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <TextInput label="Visitor Name" value={form.visitorName} onChange={(value) => setForm((current) => ({ ...current, visitorName: value }))} />
            <TextInput label="Phone Number" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
            <TextInput label="Email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
            <TextInput label="Wallet Address" value={form.walletAddress} onChange={(value) => setForm((current) => ({ ...current, walletAddress: value }))} />
            <TextInput label="Visitor Type" value={form.visitorType} onChange={(value) => setForm((current) => ({ ...current, visitorType: value }))} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => void generateIdentityHash("Pending")} className="rounded-2xl border border-red-200 bg-white px-5 py-3 font-black text-[#E30613] transition hover:-translate-y-0.5 hover:shadow-md">
              Generate Identity Hash
            </button>
            <button onClick={() => void registerIdentity()} className="rounded-2xl bg-[#E30613] px-5 py-3 font-black text-white shadow-xl shadow-red-100 transition hover:-translate-y-0.5">
              Register Identity
            </button>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">
            Revoke Identity
          </p>
          <h2 className="mt-2 text-4xl font-black">Cancel verification</h2>
          <p className="mt-4 leading-7 text-neutral-600">
            Revoke means the admin cancels the identity validity. After revocation,
            merchants should deny access when checking this visitor DID.
          </p>

          <div className="mt-6">
            <TextInput label="Revocation Reason" value={revokeReason} onChange={setRevokeReason} />
          </div>

          <button onClick={revokeIdentity} className="mt-5 rounded-2xl bg-[#111] px-5 py-3 font-black text-white transition hover:-translate-y-0.5">
            Revoke Identity
          </button>

          <div className="mt-6 rounded-[2rem] bg-[#fff4f1] p-5">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-[#E30613]">
              Example cases
            </p>
            <ul className="mt-4 space-y-2 text-sm font-semibold text-neutral-700">
              <li>• Incorrect visitor data</li>
              <li>• Suspicious wallet usage</li>
              <li>• Visitor requests identity deactivation</li>
            </ul>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.24em] text-white/45">{label}</p>
      <p className="mt-1 break-all text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-neutral-700">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-semibold outline-none transition focus:border-[#E30613] focus:ring-4 focus:ring-red-100" />
    </label>
  );
}