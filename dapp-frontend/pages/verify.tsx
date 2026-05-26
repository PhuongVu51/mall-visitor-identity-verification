import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import contractABI from "../constants/contractABI.json";

const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

type VerificationResult = "idle" | "verified" | "denied" | "pending" | "revoked";

type UserRole = "visitor" | "admin" | "merchant";

type UserSession = {
  role: UserRole;
  name: string;
  email: string;
  phone?: string;
  signedInAt: string;
};

type AuditLog = {
  id: string;
  action: string;
  walletOrDid: string;
  status: string;
  txHash: string;
  time: string;
};

type EthereumRequestArgs = {
  method: string;
  params?: unknown[];
};

type EthereumProvider = {
  request: <T = unknown>(args: EthereumRequestArgs) => Promise<T>;
};

type IdentityResultLike = {
  0?: unknown;
  1?: unknown;
  3?: unknown;
  4?: unknown;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

function shortenAddress(address: string) {
  if (!address) return "Not available";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function makeDid(address: string) {
  if (!address) return "did:lotte:not-available";
  return `did:lotte:${address}`;
}

function normalizeDidOrWallet(value: string) {
  const trimmedValue = value.trim();

  if (trimmedValue.toLowerCase().startsWith("did:lotte:")) {
    return trimmedValue.replace(/^did:lotte:/i, "").trim();
  }

  return trimmedValue;
}

function createDemoTxHash(seed: string) {
  const cleanSeed = seed.toLowerCase().replace(/[^a-f0-9]/g, "");
  const repeatedSeed = `${cleanSeed}${cleanSeed}${cleanSeed}${cleanSeed}`;
  return `0x${repeatedSeed.slice(0, 64).padEnd(64, "0")}`;
}

function safeParseSession(value: string | null): UserSession | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<UserSession>;

    if (
      parsed.role === "visitor" ||
      parsed.role === "admin" ||
      parsed.role === "merchant"
    ) {
      return {
        role: parsed.role,
        name: typeof parsed.name === "string" ? parsed.name : "Demo User",
        email: typeof parsed.email === "string" ? parsed.email : "",
        phone: typeof parsed.phone === "string" ? parsed.phone : undefined,
        signedInAt:
          typeof parsed.signedInAt === "string"
            ? parsed.signedInAt
            : new Date().toISOString(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

function appendAuditLog(log: AuditLog) {
  const rawLogs = window.localStorage.getItem("lotte_transaction_logs");

  try {
    const parsedLogs = rawLogs ? (JSON.parse(rawLogs) as unknown) : [];
    const currentLogs = Array.isArray(parsedLogs) ? parsedLogs : [];

    window.localStorage.setItem(
      "lotte_transaction_logs",
      JSON.stringify([log, ...currentLogs]),
    );
  } catch {
    window.localStorage.setItem("lotte_transaction_logs", JSON.stringify([log]));
  }
}

function getResultStyle(result: VerificationResult) {
  if (result === "verified") {
    return "border-green-200 bg-green-50 text-green-800";
  }

  if (result === "pending") {
    return "border-yellow-200 bg-yellow-50 text-yellow-800";
  }

  if (result === "revoked" || result === "denied") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  return "border-neutral-200 bg-neutral-50 text-neutral-700";
}

function getResultTitle(result: VerificationResult) {
  if (result === "verified") return "Access Granted";
  if (result === "pending") return "Pending Admin Approval";
  if (result === "revoked") return "Identity Revoked";
  if (result === "denied") return "Access Denied";
  return "Waiting for Check";
}

function getDecisionText(result: VerificationResult) {
  if (result === "verified") {
    return "This visitor can access linked mall services.";
  }

  if (result === "pending") {
    return "This identity exists, but Lotte Mall Admin has not approved it yet.";
  }

  if (result === "revoked") {
    return "This identity was revoked by Lotte Mall Admin. Access should be denied.";
  }

  if (result === "denied") {
    return "No valid verified identity was found for this DID or wallet address.";
  }

  return "Enter a visitor DID or wallet address to check the current on-chain status.";
}

export default function VerifyPage() {
  const [inputValue, setInputValue] = useState("");
  const [result, setResult] = useState<VerificationResult>("idle");
  const [message, setMessage] = useState(
    "Enter visitor DID or Wallet Address to verify access.",
  );

  const [visitorWallet, setVisitorWallet] = useState("");
  const [visitorDid, setVisitorDid] = useState("");
  const [visitorHash, setVisitorHash] = useState("");
  const [visitorCid, setVisitorCid] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [session, setSession] = useState<UserSession | null>(null);
  const [accessReady, setAccessReady] = useState(false);

  const activeRoleLabel = useMemo(() => {
    if (!session) return "Checking Access";
    if (session.role === "admin") return "Lotte Mall Admin Preview";
    return "Merchant / Service Desk";
  }, [session]);

  useEffect(() => {
    const currentSession = safeParseSession(
      window.localStorage.getItem("lotte_web2_user"),
    );

    if (!currentSession) {
      window.location.href = "/";
      return;
    }

    if (currentSession.role === "visitor") {
      window.location.href = "/visitor";
      return;
    }

    setSession(currentSession);
    setAccessReady(true);

    if (currentSession.role === "admin") {
      setMessage(
        "Admin preview mode. This page shows how merchant desks verify visitor access.",
      );
      return;
    }

    setMessage("Enter visitor DID or Wallet Address to verify access.");
  }, []);

  function pasteMyWallet() {
    const savedWallet = window.localStorage.getItem("lotte_wallet_address");

    if (!savedWallet) {
      setMessage("No connected visitor wallet found in this browser.");
      return;
    }

    setInputValue(makeDid(savedWallet));
    setMessage("Visitor DID pasted from browser storage. Ready to verify.");
  }

  function clearLookup() {
    setInputValue("");
    setResult("idle");
    setVisitorWallet("");
    setVisitorDid("");
    setVisitorHash("");
    setVisitorCid("");
    setMessage(
      session?.role === "admin"
        ? "Admin preview mode. This page shows how merchant desks verify visitor access."
        : "Enter visitor DID or Wallet Address to verify access.",
    );
  }

  async function verifyVisitor() {
    const rawInput = inputValue.trim();

    if (!rawInput) {
      setMessage("Please enter a visitor DID or Wallet Address.");
      return;
    }

    const targetAddress = normalizeDidOrWallet(rawInput).toLowerCase();

    if (!ethers.isAddress(targetAddress)) {
      setResult("denied");
      setVisitorWallet("");
      setVisitorDid("");
      setVisitorHash("");
      setVisitorCid("");
      setMessage(
        "Invalid format. Please enter a valid DID like did:lotte:0x... or a valid Wallet Address.",
      );
      return;
    }

    setIsChecking(true);
    setResult("idle");
    setVisitorWallet(targetAddress);
    setVisitorDid(makeDid(targetAddress));
    setMessage("Checking visitor identity status on blockchain...");

    try {
      if (!window.ethereum) {
        setResult("denied");
        setMessage("MetaMask is not installed. Please install MetaMask first.");
        return;
      }

      const provider = new ethers.BrowserProvider(
        window.ethereum as ethers.Eip1193Provider,
      );

      const deployedContract = new ethers.Contract(
        contractAddress,
        contractABI.abi,
        provider,
      );

      const data = (await deployedContract.getIdentity(
        targetAddress,
      )) as IdentityResultLike;

      const hash = typeof data[0] === "string" ? data[0] : "";
      const cid = typeof data[1] === "string" ? data[1] : "";
      const verified = typeof data[3] === "boolean" ? data[3] : false;
      const revoked = typeof data[4] === "boolean" ? data[4] : false;

      setVisitorHash(hash || "No identity hash found");
      setVisitorCid(cid);

      let nextResult: VerificationResult = "denied";
      let nextMessage =
        "Identity not found on blockchain. The visitor is not registered.";

      if (hash && revoked) {
        nextResult = "revoked";
        nextMessage =
          "ACCESS DENIED: This identity has been revoked by Lotte Mall Admin.";
      } else if (hash && verified) {
        nextResult = "verified";
        nextMessage =
          "ACCESS GRANTED: This visitor identity is verified and active.";
      } else if (hash && !verified) {
        nextResult = "pending";
        nextMessage =
          "ACCESS DENIED: This identity is registered but still waiting for Admin approval.";
      }

      setResult(nextResult);
      setMessage(nextMessage);

      appendAuditLog({
        id: `${Date.now()}`,
        action: "Verify",
        walletOrDid: makeDid(targetAddress),
        status:
          nextResult === "verified"
            ? "Verified"
            : nextResult === "pending"
              ? "Pending"
              : nextResult === "revoked"
                ? "Revoked"
                : "Not Found",
        txHash: createDemoTxHash(`${targetAddress}${Date.now()}`),
        time: new Date().toLocaleString(),
      });
    } catch (error) {
      console.error(error);
      setResult("denied");
      setVisitorHash("");
      setVisitorCid("");
      setMessage("Error communicating with the blockchain.");
    } finally {
      setIsChecking(false);
    }
  }

  function handleLogout() {
    window.localStorage.removeItem("lotte_web2_user");
    window.location.href = "/";
  }

  if (!accessReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff8f6] text-[#151515]">
        <div className="rounded-[2rem] border border-red-100 bg-white px-8 py-6 text-center shadow-xl shadow-red-50">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#E30613]">
            Lotte Mall West Lake
          </p>
          <h1 className="mt-3 text-2xl font-black">Checking access...</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fff8f6] text-[#151515]">
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-[#fff4f1] to-[#ffe3df]">
        <div className="absolute left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-[#E30613]/20 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[500px] w-[500px] rounded-full bg-[#E30613]/20 blur-3xl" />
        <div className="absolute right-[9%] top-28 hidden h-44 w-44 rotate-12 rounded-[3.5rem] bg-[#E30613]/10 lg:block" />

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
                  Verification Portal
                </h1>
              </div>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              {session?.role === "admin" ? (
                <Link
                  href="/admin"
                  className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm transition hover:border-[#E30613] hover:text-[#E30613]"
                >
                  Admin Portal
                </Link>
              ) : null}

              <Link
                href="/transactions"
                className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm transition hover:border-[#E30613] hover:text-[#E30613]"
              >
                Audit Log
              </Link>

              <button
                onClick={handleLogout}
                className="rounded-full border border-neutral-200 bg-neutral-100 px-5 py-3 text-sm font-black text-neutral-500 shadow-sm transition hover:bg-neutral-200 hover:text-neutral-800"
              >
                Logout
              </button>
            </div>
          </nav>

          <div className="grid gap-10 pb-16 pt-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-red-100 bg-white/85 px-5 py-3 text-sm font-black text-[#E30613] shadow-sm">
                <span className="h-3 w-3 rounded-full bg-[#E30613]" />
                {activeRoleLabel}
              </div>

              <h2 className="max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.055em] md:text-7xl">
                Verify visitor access{" "}
                <span className="text-[#E30613]">
                  without seeing private data.
                </span>
              </h2>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-neutral-700">
                Service counters check only the visitor DID or wallet address.
                Personal details such as name, phone number, and email stay
                hidden from merchants.
              </p>

              <div className="mt-8 rounded-[1.75rem] border border-red-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-400">
                  System Message
                </p>
                <p className="mt-2 font-bold text-neutral-900">{message}</p>
              </div>
            </div>

            <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-2xl shadow-red-100">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">
                    Check Visitor
                  </p>
                  <h3 className="mt-2 text-3xl font-black">
                    DID / Wallet Lookup
                  </h3>
                </div>

                <div className="rounded-2xl bg-[#fff4f1] px-4 py-3 text-right">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#E30613]">
                    Data shown
                  </p>
                  <p className="mt-1 text-sm font-black text-neutral-900">
                    Status only
                  </p>
                </div>
              </div>

              <label className="mt-6 block">
                <span className="text-sm font-black text-neutral-700">
                  Enter DID or Wallet Address
                </span>
                <input
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  placeholder="e.g. did:lotte:0x... or 0x..."
                  className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-semibold outline-none transition placeholder:text-neutral-400 focus:border-[#E30613] focus:ring-4 focus:ring-red-50"
                />
              </label>

              <div className="mt-5 grid gap-3 md:grid-cols-[0.85fr_1.15fr]">
                <button
                  onClick={pasteMyWallet}
                  className="rounded-2xl border border-red-100 bg-white px-5 py-4 font-black text-[#E30613] shadow-sm transition hover:-translate-y-0.5 hover:border-[#E30613] hover:shadow-md"
                >
                  Paste Visitor DID
                </button>

                <button
                  onClick={verifyVisitor}
                  disabled={isChecking}
                  className="rounded-2xl bg-[#E30613] px-5 py-4 font-black text-white shadow-xl shadow-red-200 transition hover:-translate-y-0.5 hover:bg-[#bd000a] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                >
                  {isChecking ? "Checking..." : "Verify On-Chain Status"}
                </button>
              </div>

              <button
                onClick={clearLookup}
                className="mt-3 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-3 text-sm font-black text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
              >
                Clear Lookup
              </button>

              <div
                className={`mt-6 rounded-[2rem] border p-6 ${getResultStyle(
                  result,
                )}`}
              >
                <p className="text-sm font-black uppercase tracking-[0.28em]">
                  Result
                </p>

                <h3 className="mt-3 text-3xl font-black">
                  {getResultTitle(result)}
                </h3>

                <p className="mt-3 text-sm font-bold opacity-80">
                  {getDecisionText(result)}
                </p>

                {visitorWallet ? (
                  <div className="mt-5 grid gap-3 rounded-2xl bg-white/70 p-4 text-neutral-900">
                    <ResultRow label="Wallet" value={shortenAddress(visitorWallet)} />
                    <ResultRow label="DID" value={visitorDid} />
                    <ResultRow
                      label="Identity Hash"
                      value={visitorHash || "Not loaded"}
                    />
                  </div>
                ) : null}

                {result !== "idle" && visitorCid ? (
                  <div className="mt-5">
                    <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-neutral-400">
                      Visitor Photo Proof
                    </p>
                    <img
                      src={`https://ipfs.io/ipfs/${visitorCid}`}
                      alt="Verified visitor profile"
                      className="h-48 w-full rounded-xl border border-neutral-200 object-cover shadow-sm"
                    />
                    <p className="mt-2 break-all text-xs font-bold opacity-70">
                      IPFS CID: {visitorCid}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-14 lg:grid-cols-3">
        <InfoCard
          title="Merchant"
          description="Only checks whether the visitor identity is valid."
        />
        <InfoCard
          title="Private data"
          description="Name, email, and phone number are not shown on this page."
        />
        <InfoCard
          title="Access decision"
          description="Verified means access granted. Pending, revoked, or not found means denied."
        />
      </section>
    </main>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-400">
        {label}
      </p>
      <p className="mt-1 break-all text-sm font-black text-neutral-900">{value}</p>
    </div>
  );
}

function InfoCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[2rem] border border-red-100 bg-white p-6 shadow-sm">
      <h3 className="text-2xl font-black">{title}</h3>
      <p className="mt-3 leading-7 text-neutral-600">{description}</p>
    </div>
  );
}