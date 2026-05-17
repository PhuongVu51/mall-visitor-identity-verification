import { useEffect, useState } from "react";
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

function shortenAddress(address: string) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function makeDid(address: string) {
  if (!address) return "did:lotte:not-connected";
  return `did:lotte:${address}`;
}

export default function Home() {
  const [walletAddress, setWalletAddress] = useState("");
  const [networkLabel, setNetworkLabel] = useState("Not connected");
  const [statusMessage, setStatusMessage] = useState(
    "Connect MetaMask to start the visitor identity flow.",
  );

  useEffect(() => {
    const savedWallet = window.localStorage.getItem("lotte_wallet_address");
    const savedNetwork = window.localStorage.getItem("lotte_network_label");

    if (savedWallet) {
      setWalletAddress(savedWallet);
      setStatusMessage(`Wallet already connected: ${savedWallet}`);
    }

    if (savedNetwork) {
      setNetworkLabel(savedNetwork);
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

  return (
    <main className="min-h-screen bg-[#fff8f6] text-[#151515]">
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-[#fff4f1] to-[#ffe1dc]">
        <div className="absolute left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-[#E30613]/20 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[480px] w-[480px] rounded-full bg-[#E30613]/25 blur-3xl" />
        <div className="absolute right-[12%] top-28 hidden h-40 w-40 rotate-12 rounded-[3rem] bg-[#E30613] opacity-10 lg:block" />
        <div className="absolute left-[42%] top-40 hidden h-20 w-20 rounded-full bg-black opacity-5 lg:block" />

        <div className="relative mx-auto max-w-7xl px-6 py-7">
          <nav className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-[#E30613] text-3xl font-black text-white shadow-xl shadow-red-200">
                L
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-[#E30613]">
                  Lotte Mall West Lake
                </p>
                <h1 className="text-xl font-black tracking-tight md:text-2xl">
                  Visitor Identity Verification
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/visitor"
                className="rounded-full border border-red-100 bg-white/80 px-5 py-3 text-sm font-black text-neutral-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-[#E30613] hover:text-[#E30613] hover:shadow-md"
              >
                Visitor Wallet
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

          <div className="grid gap-12 pb-20 pt-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-red-100 bg-white/85 px-5 py-3 text-sm font-black text-[#E30613] shadow-sm backdrop-blur">
                <span className="flex h-3 w-3 rounded-full bg-[#E30613]" />
                Blockchain-based Identity Management System
              </div>

              <h2 className="max-w-5xl text-5xl font-black leading-[0.98] tracking-[-0.055em] text-[#111] md:text-7xl">
                One visitor identity for{" "}
                <span className="text-[#E30613]">mall-wide verification.</span>
              </h2>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-neutral-700 md:text-xl md:leading-9">
                A Web3 identity verification prototype for Lotte Mall West Lake,
                allowing visitors to prove verification status across parking,
                event desks, cinema counters, and merchants without repeatedly
                exposing private information.
              </p>

              <div className="mt-9 flex flex-wrap gap-4">
                <button
                  onClick={connectWallet}
                  className="rounded-2xl bg-[#E30613] px-7 py-4 text-base font-black text-white shadow-2xl shadow-red-200 transition hover:-translate-y-1 hover:bg-[#bd000a]"
                >
                  Connect Wallet
                </button>

                <Link
                  href="/admin"
                  className="rounded-2xl border border-neutral-200 bg-white px-7 py-4 text-base font-black text-neutral-950 shadow-sm transition hover:-translate-y-1 hover:border-[#E30613] hover:text-[#E30613] hover:shadow-xl"
                >
                  Start Admin Demo
                </Link>

                <Link
                  href="/verify"
                  className="rounded-2xl border border-neutral-200 bg-white px-7 py-4 text-base font-black text-neutral-950 shadow-sm transition hover:-translate-y-1 hover:border-[#E30613] hover:text-[#E30613] hover:shadow-xl"
                >
                  Go to Verification
                </Link>
              </div>

              <div className="mt-9 max-w-2xl rounded-[1.75rem] border border-red-100 bg-white/80 p-5 shadow-sm backdrop-blur">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-400">
                  Current system status
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
                        Visitor DID Card
                      </p>
                      <h3 className="mt-4 text-3xl font-black tracking-tight">
                        {walletAddress ? "Wallet Connected" : "Waiting for Wallet"}
                      </h3>
                    </div>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl">
                      🔐
                    </div>
                  </div>

                  <div className="mt-8 space-y-4 rounded-[1.5rem] bg-white/10 p-5 backdrop-blur">
                    <IdentityRow label="Wallet Address" value={shortenAddress(walletAddress)} />
                    <IdentityRow label="Visitor DID" value={makeDid(walletAddress)} />
                    <IdentityRow label="Network" value={networkLabel} />
                    <IdentityRow
                      label="Verification Status"
                      value={walletAddress ? "Ready for registration" : "Disconnected"}
                    />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <MiniCard title="On-chain data" value="Hash only" />
                  <MiniCard title="Privacy" value="No raw PII" />
                  <MiniCard title="Parties" value="3 roles" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-[#E30613]">
              System modules
            </p>
            <h2 className="mt-2 text-4xl font-black tracking-tight md:text-5xl">
              Real screens for a real identity flow.
            </h2>
          </div>
          <p className="max-w-xl text-base leading-7 text-neutral-600">
            The prototype is separated into role-based pages, so the demo feels
            like a real mall operation system rather than a single technical form.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <ModuleCard
            href="/visitor"
            eyebrow="Visitor"
            title="DID Wallet"
            description="Displays wallet address, DID, identity hash, access level, and verification status."
            icon="🪪"
          />
          <ModuleCard
            href="/admin"
            eyebrow="Lotte Admin"
            title="Register Identity"
            description="Creates a visitor identity hash from private information and prepares blockchain registration."
            icon="🏢"
          />
          <ModuleCard
            href="/verify"
            eyebrow="Merchant"
            title="Verify Visitor"
            description="Checks visitor DID or wallet address without revealing phone number or email."
            icon="✅"
          />
          <ModuleCard
            href="/transactions"
            eyebrow="Blockchain"
            title="Transaction Log"
            description="Shows audit trail for registration, verification, and revocation actions."
            icon="⛓️"
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="grid gap-6 rounded-[2.5rem] border border-red-100 bg-white p-6 shadow-xl shadow-red-50 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] bg-[#111] p-7 text-white">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-white/45">
              Why blockchain?
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-tight">
              Shared verification without shared customer databases.
            </h2>
            <p className="mt-5 leading-8 text-white/70">
              In a shopping mall, merchants, event desks, parking counters, and
              mall administrators are separate parties. Blockchain acts as a
              trusted verification layer where only identity hash and status are
              shared, while sensitive visitor information stays off-chain.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ReasonCard
              title="Visitor privacy"
              description="Phone number, email, and name are converted into a hash instead of being stored directly on-chain."
            />
            <ReasonCard
              title="Multi-party trust"
              description="Different mall services can verify status without owning the same customer database."
            />
            <ReasonCard
              title="Audit trail"
              description="Registration, verification, and revocation can be represented as blockchain transaction records."
            />
            <ReasonCard
              title="DID concept"
              description="The wallet address acts as a simplified decentralized identity for the prototype."
            />
          </div>
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
      <p className="mt-2 text-lg font-black text-[#111]">{value}</p>
    </div>
  );
}

function ModuleCard({
  href,
  eyebrow,
  title,
  description,
  icon,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[2rem] border border-red-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#E30613] hover:shadow-2xl hover:shadow-red-100"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff4f1] text-2xl transition group-hover:bg-[#E30613]">
        {icon}
      </div>
      <p className="mt-6 text-xs font-black uppercase tracking-[0.28em] text-[#E30613]">
        {eyebrow}
      </p>
      <h3 className="mt-3 text-2xl font-black tracking-tight">{title}</h3>
      <p className="mt-3 leading-7 text-neutral-600">{description}</p>
      <p className="mt-6 font-black text-[#E30613]">Open module →</p>
    </Link>
  );
}

function ReasonCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[1.5rem] border border-neutral-100 bg-[#fffaf8] p-5">
      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-3 leading-7 text-neutral-600">{description}</p>
    </div>
  );
}