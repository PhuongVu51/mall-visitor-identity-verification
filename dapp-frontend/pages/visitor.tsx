import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type EthereumRequestArgs = {
  method: string;
  params?: unknown[];
};

type EthereumProvider = {
  request: <T = unknown>(args: EthereumRequestArgs) => Promise<T>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

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

function shortenAddress(address: string) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function makeDid(address: string) {
  if (!address) return "did:lotte:not-connected";
  return `did:lotte:${address}`;
}

function createDemoHash(address: string) {
  if (!address) {
    return "0x0000000000000000000000000000000000000000000000000000000000000000";
  }

  const clean = address.toLowerCase().replace("0x", "");
  const repeated = `${clean}${clean}${clean}${clean}`;
  return `0x${repeated.slice(0, 64).padEnd(64, "0")}`;
}

function getStatusStyle(status: IdentityStatus) {
  if (status === "Verified") {
    return "bg-green-100 text-green-700 border-green-200";
  }

  if (status === "Revoked") {
    return "bg-red-100 text-red-700 border-red-200";
  }

  if (status === "Pending") {
    return "bg-yellow-100 text-yellow-700 border-yellow-200";
  }

  return "bg-neutral-100 text-neutral-600 border-neutral-200";
}

export default function VisitorWalletPage() {
  const [walletAddress, setWalletAddress] = useState("");
  const [networkLabel, setNetworkLabel] = useState("Not connected");
  const [statusMessage, setStatusMessage] = useState(
    "Connect MetaMask to view your visitor digital identity.",
  );
  const [identity, setIdentity] = useState<StoredIdentity | null>(null);

  const did = useMemo(() => makeDid(walletAddress), [walletAddress]);
  const fallbackHash = useMemo(() => createDemoHash(walletAddress), [walletAddress]);

  const currentStatus: IdentityStatus = identity?.status ?? "Not Registered";
  const currentAccess = identity?.accessLevel ?? [
    "Parking",
    "Event Desk",
    "Merchant Check",
  ];

  useEffect(() => {
    const savedWallet = window.localStorage.getItem("lotte_wallet_address");
    const savedNetwork = window.localStorage.getItem("lotte_network_label");
    const savedIdentity = window.localStorage.getItem("lotte_visitor_identity");

    if (savedWallet) {
      setWalletAddress(savedWallet);
      setStatusMessage(`Wallet loaded from browser storage: ${savedWallet}`);
    }

    if (savedNetwork) {
      setNetworkLabel(savedNetwork);
    }

    if (savedIdentity) {
      try {
        const parsedIdentity = JSON.parse(savedIdentity) as StoredIdentity;
        setIdentity(parsedIdentity);
      } catch {
        window.localStorage.removeItem("lotte_visitor_identity");
      }
    }
  }, []);

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        setStatusMessage("MetaMask is not installed. Please install MetaMask first.");
        return;
      }

      const accounts = await window.ethereum.request<string[]>({
        method: "eth_requestAccounts",
      });

      const selectedAccount = accounts[0];

      if (!selectedAccount) {
        setStatusMessage("No wallet account selected.");
        return;
      }

      setWalletAddress(selectedAccount);
      window.localStorage.setItem("lotte_wallet_address", selectedAccount);

      try {
        const chainId = await window.ethereum.request<string>({
          method: "eth_chainId",
        });

        let resolvedNetwork = `Connected network: ${chainId}`;

        if (chainId === "0x7a69") {
          resolvedNetwork = "Hardhat Localhost";
        }

        if (chainId === "0xaa36a7") {
          resolvedNetwork = "Sepolia Testnet";
        }

        setNetworkLabel(resolvedNetwork);
        window.localStorage.setItem("lotte_network_label", resolvedNetwork);
      } catch {
        setNetworkLabel("MetaMask connected");
        window.localStorage.setItem("lotte_network_label", "MetaMask connected");
      }

      setStatusMessage(`Wallet connected: ${selectedAccount}`);
    } catch {
      setStatusMessage("Wallet connection was rejected or failed.");
    }
  }

  function createVisitorPreview() {
    if (!walletAddress) {
      setStatusMessage("Please connect wallet before creating DID preview.");
      return;
    }

    const previewIdentity: StoredIdentity = {
      did,
      walletAddress,
      identityHash: fallbackHash,
      status: "Pending",
      accessLevel: ["Parking", "Event Desk", "Merchant Check"],
      visitorName: "Demo Visitor",
      visitorType: "Lotte Mall Visitor",
      issuedAt: new Date().toLocaleString(),
    };

    setIdentity(previewIdentity);
    window.localStorage.setItem(
      "lotte_visitor_identity",
      JSON.stringify(previewIdentity),
    );
    setStatusMessage(
      "Visitor DID preview created. Admin can verify this identity in the Admin Portal.",
    );
  }

  return (
    <main className="min-h-screen bg-[#fff8f6] text-[#151515]">
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-[#fff4f1] to-[#ffe3df]">
        <div className="absolute left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-[#E30613]/20 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[480px] w-[480px] rounded-full bg-[#E30613]/25 blur-3xl" />
        <div className="absolute right-[10%] top-32 hidden h-44 w-44 rotate-12 rounded-[3.5rem] bg-[#E30613] opacity-10 lg:block" />
        <div className="absolute left-[46%] top-28 hidden h-24 w-24 rounded-full bg-black opacity-5 lg:block" />

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
                  Visitor DID Wallet
                </h1>
              </div>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-[#E30613] hover:text-[#E30613] hover:shadow-md"
              >
                Home
              </Link>
              <Link
                href="/admin"
                className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-[#E30613] hover:text-[#E30613] hover:shadow-md"
              >
                Admin Portal
              </Link>
              <Link
                href="/verify"
                className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-[#E30613] hover:text-[#E30613] hover:shadow-md"
              >
                Verify
              </Link>
              <button
                onClick={connectWallet}
                className="rounded-full bg-[#E30613] px-5 py-3 text-sm font-black text-white shadow-xl shadow-red-200 transition hover:-translate-y-0.5 hover:bg-[#bd000a]"
              >
                Connect Wallet
              </button>
            </div>
          </nav>

          <div className="grid gap-12 pb-16 pt-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-red-100 bg-white/85 px-5 py-3 text-sm font-black text-[#E30613] shadow-sm backdrop-blur">
                <span className="flex h-3 w-3 rounded-full bg-[#E30613]" />
                Visitor Digital Identity
              </div>

              <h2 className="max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.055em] text-[#111] md:text-7xl">
                Your mall identity,{" "}
                <span className="text-[#E30613]">without exposing private data.</span>
              </h2>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-neutral-700 md:text-xl md:leading-9">
                This page represents the visitor side of the system. A visitor
                connects MetaMask, receives a DID format, and can show verified
                status to parking, event desks, cinema counters, or merchants.
              </p>

              <div className="mt-9 flex flex-wrap gap-4">
                <button
                  onClick={connectWallet}
                  className="rounded-2xl bg-[#E30613] px-7 py-4 text-base font-black text-white shadow-2xl shadow-red-200 transition hover:-translate-y-1 hover:bg-[#bd000a]"
                >
                  Connect Wallet
                </button>

                <button
                  onClick={createVisitorPreview}
                  className="rounded-2xl border border-neutral-200 bg-white px-7 py-4 text-base font-black text-neutral-950 shadow-sm transition hover:-translate-y-1 hover:border-[#E30613] hover:text-[#E30613] hover:shadow-xl"
                >
                  Create DID Preview
                </button>

                <Link
                  href="/admin"
                  className="rounded-2xl border border-neutral-200 bg-white px-7 py-4 text-base font-black text-neutral-950 shadow-sm transition hover:-translate-y-1 hover:border-[#E30613] hover:text-[#E30613] hover:shadow-xl"
                >
                  Request Verification
                </Link>
              </div>

              <div className="mt-9 max-w-2xl rounded-[1.75rem] border border-red-100 bg-white/80 p-5 shadow-sm backdrop-blur">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-400">
                  Visitor wallet status
                </p>
                <p className="mt-2 break-all text-base font-bold text-neutral-900">
                  {statusMessage}
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-8 -top-8 hidden h-24 w-24 rounded-[2rem] bg-[#E30613]/10 lg:block" />
              <div className="absolute -bottom-8 -right-8 hidden h-32 w-32 rounded-full bg-black/5 lg:block" />

              <div className="relative overflow-hidden rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-2xl shadow-red-100">
                <div className="rounded-[2rem] bg-gradient-to-br from-[#E30613] via-[#ce0010] to-[#790006] p-7 text-white">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.32em] text-white/55">
                        Lotte Visitor DID
                      </p>
                      <h3 className="mt-4 text-3xl font-black tracking-tight">
                        {walletAddress ? "Digital Wallet Active" : "Wallet Required"}
                      </h3>
                    </div>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl">
                      🪪
                    </div>
                  </div>

                  <div className="mt-8 rounded-[1.5rem] bg-white/10 p-5 backdrop-blur">
                    <div className="flex flex-col gap-4">
                      <IdentityRow label="Visitor DID" value={identity?.did ?? did} />
                      <IdentityRow
                        label="Wallet Address"
                        value={identity?.walletAddress ?? shortenAddress(walletAddress)}
                      />
                      <IdentityRow
                        label="Identity Hash"
                        value={identity?.identityHash ?? fallbackHash}
                      />
                      <IdentityRow label="Network" value={networkLabel} />
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <MiniCard title="Verification" value={currentStatus} />
                  <MiniCard title="Identity Type" value={identity?.visitorType ?? "Visitor"} />
                  <MiniCard title="Privacy" value="Hash only" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-14 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">
            Visitor profile
          </p>
          <h2 className="mt-2 text-4xl font-black tracking-tight">
            Identity overview
          </h2>

          <div className="mt-6 space-y-4">
            <ProfileItem label="Visitor Name" value={identity?.visitorName ?? "Not registered yet"} />
            <ProfileItem label="Visitor Type" value={identity?.visitorType ?? "Lotte Mall Visitor"} />
            <ProfileItem label="Issued At" value={identity?.issuedAt ?? "Waiting for admin registration"} />
            <ProfileItem label="DID Format" value="did:lotte:{walletAddress}" />
          </div>

          <div className={`mt-6 rounded-3xl border p-5 ${getStatusStyle(currentStatus)}`}>
            <p className="text-sm font-black uppercase tracking-[0.25em]">
              Current Status
            </p>
            <p className="mt-2 text-3xl font-black">{currentStatus}</p>
            <p className="mt-3 text-sm font-semibold opacity-80">
              {currentStatus === "Verified"
                ? "This visitor can be checked by merchants or mall service desks."
                : currentStatus === "Revoked"
                  ? "This visitor identity is no longer valid."
                  : currentStatus === "Pending"
                    ? "This identity has been created but still needs admin verification."
                    : "The visitor has not registered identity data yet."}
            </p>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">
                Mall access
              </p>
              <h2 className="mt-2 text-4xl font-black tracking-tight">
                Services linked to this DID
              </h2>
            </div>
            <Link
              href="/verify"
              className="rounded-2xl bg-[#111] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5"
            >
              Open Verification Portal
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {currentAccess.map((item) => (
              <AccessCard
                key={item}
                title={item}
                status={currentStatus === "Verified" ? "Available" : "Requires verification"}
              />
            ))}
          </div>

          <div className="mt-6 rounded-[2rem] bg-[#111] p-6 text-white">
            <p className="text-sm font-black uppercase tracking-[0.28em] text-white/45">
              Privacy note
            </p>
            <h3 className="mt-3 text-2xl font-black">
              Personal information is not shown to merchants.
            </h3>
            <p className="mt-4 leading-7 text-white/70">
              In the full blockchain implementation, name, phone, and email are
              converted into an identity hash. Merchants only verify the DID or
              wallet address and receive a status result such as Verified or
              Revoked.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="grid gap-6 rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-xl shadow-red-50 lg:grid-cols-3">
          <StepCard
            number="01"
            title="Connect wallet"
            description="Visitor connects MetaMask. The wallet address acts as a simplified decentralized identity."
          />
          <StepCard
            number="02"
            title="Generate DID"
            description="The system formats the visitor identifier as did:lotte:{walletAddress} for mall service verification."
          />
          <StepCard
            number="03"
            title="Verify status"
            description="Admin or merchants can check whether the identity is pending, verified, or revoked."
          />
        </div>
      </section>
    </main>
  );
}

function IdentityRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.24em] text-white/45">
        {label}
      </p>
      <p className="mt-1 break-all text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function MiniCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#fff4f1] p-4">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-[#E30613]">
        {title}
      </p>
      <p className="mt-2 break-words text-lg font-black text-[#111]">{value}</p>
    </div>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-[#fffaf8] p-4">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-400">
        {label}
      </p>
      <p className="mt-2 break-all text-base font-black text-neutral-950">{value}</p>
    </div>
  );
}

function AccessCard({ title, status }: { title: string; status: string }) {
  return (
    <div className="rounded-[1.5rem] border border-red-100 bg-[#fffaf8] p-5">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
        {title.includes("Parking") ? "🅿️" : title.includes("Event") ? "🎟️" : "🏬"}
      </div>
      <h3 className="mt-4 text-xl font-black">{title}</h3>
      <p className="mt-2 text-sm font-bold text-[#E30613]">{status}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[2rem] bg-[#fff4f1] p-6">
      <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">
        {number}
      </p>
      <h3 className="mt-4 text-2xl font-black">{title}</h3>
      <p className="mt-3 leading-7 text-neutral-600">{description}</p>
    </div>
  );
}