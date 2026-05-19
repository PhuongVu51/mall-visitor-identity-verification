"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/router";

type UserRole = "visitor" | "admin" | "merchant";

type StoredVisitorUser = {
  role: "visitor";
  name: string;
  phone: string;
  email: string;
  password: string;
  createdAt: string;
};

type UserSession = {
  role: UserRole;
  name: string;
  email: string;
  phone?: string;
  signedInAt: string;
};

const ADMIN_EMAIL = "admin@lotte.com";
const ADMIN_PASSWORD = "admin123";

const MERCHANT_EMAIL = "service@lotte.com";
const MERCHANT_PASSWORD = "service123";

function safeParseVisitors(value: string | null): StoredVisitorUser[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is StoredVisitorUser => {
      if (typeof item !== "object" || item === null) return false;

      const user = item as Partial<StoredVisitorUser>;

      return (
        user.role === "visitor" &&
        typeof user.name === "string" &&
        typeof user.phone === "string" &&
        typeof user.email === "string" &&
        typeof user.password === "string" &&
        typeof user.createdAt === "string"
      );
    });
  } catch {
    return [];
  }
}

function createSession(user: Omit<UserSession, "signedInAt">): UserSession {
  return {
    ...user,
    signedInAt: new Date().toISOString(),
  };
}

function getRedirectPath(role: UserRole) {
  if (role === "admin") return "/admin";
  if (role === "merchant") return "/verify";
  return "/visitor";
}

export default function LoginPortal() {
  const router = useRouter();

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [selectedRole, setSelectedRole] = useState<UserRole>("visitor");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const pageTitle = useMemo(() => {
    if (!isLoginMode) return "Create Visitor Account";
    if (selectedRole === "admin") return "Lotte Mall Admin";
    if (selectedRole === "merchant") return "Merchant Desk";
    return "Visitor Sign In";
  }, [isLoginMode, selectedRole]);

  const pageDescription = useMemo(() => {
    if (!isLoginMode) return "Create a visitor profile for DID access.";
    if (selectedRole === "admin") return "Register, verify, and revoke visitor identities.";
    if (selectedRole === "merchant") return "Check DID or wallet status only.";
    return "Access your visitor DID wallet.";
  }, [isLoginMode, selectedRole]);

  useEffect(() => {
    const currentUser = window.localStorage.getItem("lotte_web2_user");

    if (!currentUser) return;

    try {
      const user = JSON.parse(currentUser) as Partial<UserSession>;

      if (
        user.role === "admin" ||
        user.role === "visitor" ||
        user.role === "merchant"
      ) {
        router.push(getRedirectPath(user.role));
      }
    } catch {
      window.localStorage.removeItem("lotte_web2_user");
    }
  }, [router]);

  function resetForm() {
    setName("");
    setPhone("");
    setEmail("");
    setPassword("");
    setErrorMsg("");
  }

  function switchMode(nextMode: "login" | "signup") {
    setIsLoginMode(nextMode === "login");
    setSelectedRole("visitor");
    resetForm();
  }

  function chooseRole(role: UserRole) {
    setSelectedRole(role);
    setErrorMsg("");
    setIsLoginMode(true);

    if (role === "admin") {
      setEmail(ADMIN_EMAIL);
      setPassword(ADMIN_PASSWORD);
      return;
    }

    if (role === "merchant") {
      setEmail(MERCHANT_EMAIL);
      setPassword(MERCHANT_PASSWORD);
      return;
    }

    setEmail("");
    setPassword("");
  }

  function validateSignup() {
    if (!name.trim() || !phone.trim() || !email.trim() || !password.trim()) {
      return "Please fill in all fields.";
    }

    if (!email.includes("@")) {
      return "Please enter a valid email.";
    }

    if (password.length < 6) {
      return "Password must be at least 6 characters.";
    }

    return "";
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMsg("");
    setIsLoading(true);

    window.setTimeout(() => {
      if (isLoginMode) {
        if (selectedRole === "admin") {
          if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            const session = createSession({
              role: "admin",
              name: "Lotte Mall Admin",
              email,
            });

            window.localStorage.setItem("lotte_web2_user", JSON.stringify(session));
            router.push("/admin");
            return;
          }

          setErrorMsg("Invalid admin account.");
          setIsLoading(false);
          return;
        }

        if (selectedRole === "merchant") {
          if (email === MERCHANT_EMAIL && password === MERCHANT_PASSWORD) {
            const session = createSession({
              role: "merchant",
              name: "Merchant / Service Desk",
              email,
            });

            window.localStorage.setItem("lotte_web2_user", JSON.stringify(session));
            router.push("/verify");
            return;
          }

          setErrorMsg("Invalid service desk account.");
          setIsLoading(false);
          return;
        }

        const savedUsers = safeParseVisitors(
          window.localStorage.getItem("lotte_users_db"),
        );

        const foundUser = savedUsers.find(
          (user) => user.email === email && user.password === password,
        );

        if (!foundUser) {
          setErrorMsg("Invalid visitor account.");
          setIsLoading(false);
          return;
        }

        const session = createSession({
          role: "visitor",
          name: foundUser.name,
          email: foundUser.email,
          phone: foundUser.phone,
        });

        window.localStorage.setItem("lotte_web2_user", JSON.stringify(session));
        router.push("/visitor");
        return;
      }

      const validationMessage = validateSignup();

      if (validationMessage) {
        setErrorMsg(validationMessage);
        setIsLoading(false);
        return;
      }

      const savedUsers = safeParseVisitors(
        window.localStorage.getItem("lotte_users_db"),
      );

      const isExistingUser = savedUsers.some((user) => user.email === email);

      if (isExistingUser) {
        setErrorMsg("Email already exists.");
        setIsLoading(false);
        return;
      }

      const newUser: StoredVisitorUser = {
        role: "visitor",
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password,
        createdAt: new Date().toISOString(),
      };

      window.localStorage.setItem(
        "lotte_users_db",
        JSON.stringify([...savedUsers, newUser]),
      );

      const session = createSession({
        role: "visitor",
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
      });

      window.localStorage.setItem("lotte_web2_user", JSON.stringify(session));
      router.push("/visitor");
    }, 450);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fff8f6] text-[#151515]">
      <div className="pointer-events-none absolute left-[-180px] top-[-180px] h-[460px] w-[460px] rounded-full bg-[#E30613]/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-220px] right-[-160px] h-[540px] w-[540px] rounded-full bg-[#E30613]/20 blur-3xl" />
      <div className="pointer-events-none absolute right-[8%] top-20 hidden h-44 w-44 rotate-12 rounded-[3.5rem] bg-[#E30613]/10 lg:block" />
      <div className="pointer-events-none absolute left-[48%] top-40 hidden h-24 w-24 rounded-full bg-black/5 lg:block" />

      <section className="relative z-10 grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="flex flex-col px-6 py-7 md:px-10 lg:px-16">
          <header className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[1.35rem] bg-white shadow-xl shadow-red-100">
              <img
                src="/lotte%20mall.png"
                alt="Lotte Mall West Lake Hanoi"
                className="h-full w-full object-cover"
              />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#E30613]">
                Lotte Mall West Lake
              </p>
              <h1 className="text-xl font-black tracking-tight md:text-2xl">
                Identity Gateway
              </h1>
            </div>
          </header>

          <div className="flex flex-1 items-center py-12">
            <div className="max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-red-100 bg-white/85 px-5 py-3 text-sm font-black text-[#E30613] shadow-sm backdrop-blur">
                <span className="h-3 w-3 rounded-full bg-[#E30613]" />
                Visitor Identity Verification
              </div>

              <h2 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.06em] md:text-7xl">
                One account,{" "}
                <span className="text-[#E30613]">one mall identity.</span>
              </h2>

              <p className="mt-7 max-w-xl text-lg leading-8 text-neutral-700">
                A simple gateway for visitors, Lotte Mall Admin, and service desks
                to access the right identity screen.
              </p>

              <div className="mt-9 grid max-w-2xl gap-4 md:grid-cols-3">
                <InfoCard
                  title="Visitor"
                  description="DID wallet"
                  icon={<VisitorIcon />}
                />
                <InfoCard
                  title="Lotte Mall Admin"
                  description="Verify identity"
                  icon={<AdminIcon />}
                />
                <InfoCard
                  title="Merchant Desk"
                  description="Check access"
                  icon={<VerifyIcon />}
                />
              </div>

              <div className="mt-8 rounded-[2rem] border border-red-100 bg-white/75 p-5 shadow-sm backdrop-blur">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-400">
                  Demo Login
                </p>
                <div className="mt-3 space-y-2 text-sm font-bold text-neutral-800">
                  <p>Admin: admin@lotte.com / admin123</p>
                  <p>Merchant Desk: service@lotte.com / service123</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section className="flex items-center justify-center border-t border-red-100 bg-white/45 px-6 py-10 backdrop-blur md:px-10 lg:border-l lg:border-t-0 lg:px-14">
          <div className="w-full max-w-[560px]">
            <div className="mb-5 grid grid-cols-2 rounded-[1.5rem] border border-red-100 bg-white p-2 shadow-sm">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`rounded-[1.1rem] px-4 py-3 text-sm font-black transition ${
                  isLoginMode
                    ? "bg-[#E30613] text-white shadow-lg shadow-red-100"
                    : "text-neutral-600 hover:bg-[#fff4f1]"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={`rounded-[1.1rem] px-4 py-3 text-sm font-black transition ${
                  !isLoginMode
                    ? "bg-[#E30613] text-white shadow-lg shadow-red-100"
                    : "text-neutral-600 hover:bg-[#fff4f1]"
                }`}
              >
                Sign Up
              </button>
            </div>

            {isLoginMode ? (
              <div className="mb-5 grid gap-3 md:grid-cols-3">
                <RoleButton
                  active={selectedRole === "visitor"}
                  title="Visitor"
                  icon={<VisitorIcon />}
                  onClick={() => chooseRole("visitor")}
                />
                <RoleButton
                  active={selectedRole === "admin"}
                  title="Admin"
                  icon={<AdminIcon />}
                  onClick={() => chooseRole("admin")}
                />
                <RoleButton
                  active={selectedRole === "merchant"}
                  title="Merchant Desk"
                  icon={<VerifyIcon />}
                  onClick={() => chooseRole("merchant")}
                />
              </div>
            ) : null}

            <div className="rounded-[2.5rem] border border-red-100 bg-white p-8 shadow-2xl shadow-red-100 md:p-10">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-[1.7rem] bg-[#fff4f1] shadow-sm">
                  <img
                    src="/lotte%20mall.png"
                    alt="Lotte Mall West Lake Hanoi"
                    className="h-full w-full object-cover"
                  />
                </div>

                <p className="text-xs font-black uppercase tracking-[0.32em] text-[#E30613]">
                  {isLoginMode ? pageTitle : "Visitor Registration"}
                </p>

                <h2 className="mt-3 text-4xl font-black tracking-tight">
                  {isLoginMode ? "Welcome Back" : "Create Account"}
                </h2>

                <p className="mt-3 text-sm font-semibold text-neutral-500">
                  {pageDescription}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {!isLoginMode ? (
                  <>
                    <Field
                      label="Full Name"
                      type="text"
                      value={name}
                      onChange={setName}
                      placeholder="Nguyen Minh Thuy"
                    />

                    <Field
                      label="Phone Number"
                      type="text"
                      value={phone}
                      onChange={setPhone}
                      placeholder="0912345678"
                    />
                  </>
                ) : null}

                <Field
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder={
                    selectedRole === "admin"
                      ? ADMIN_EMAIL
                      : selectedRole === "merchant"
                        ? MERCHANT_EMAIL
                        : "visitor@example.com"
                  }
                />

                <Field
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                />

                {errorMsg ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-center text-sm font-black text-red-600">
                    {errorMsg}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center rounded-2xl bg-[#E30613] py-4 text-base font-black text-white shadow-xl shadow-red-200 transition hover:-translate-y-1 hover:bg-[#bd000a] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                >
                  {isLoading
                    ? "Processing..."
                    : isLoginMode
                      ? "Sign In"
                      : "Create Visitor Account"}
                </button>
              </form>

              <button
                type="button"
                onClick={() => switchMode(isLoginMode ? "signup" : "login")}
                className="mt-6 w-full text-center text-sm font-black text-[#E30613] transition hover:text-[#bd000a]"
              >
                {isLoginMode ? "New visitor? Sign up" : "Already have an account?"}
              </button>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type: "text" | "email" | "password";
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-neutral-400">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-neutral-200 bg-[#fffaf8] px-5 py-4 text-sm font-bold text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[#E30613] focus:bg-white focus:ring-4 focus:ring-red-50"
      />
    </div>
  );
}

function RoleButton({
  active,
  title,
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
 icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[1.4rem] border p-4 text-center transition ${
        active
          ? "border-[#E30613] bg-[#fff4f1] shadow-lg shadow-red-50"
          : "border-red-100 bg-white hover:-translate-y-0.5 hover:shadow-md"
      }`}
    >
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff4f1] text-[#E30613]">
        {icon}
      </div>
      <p className="mt-3 text-sm font-black">{title}</p>
    </button>
  );
}

function InfoCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[1.5rem] border border-red-100 bg-white/80 p-5 shadow-sm backdrop-blur">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff4f1] text-[#E30613]">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-black">{title}</h3>
      <p className="mt-2 text-sm font-semibold text-neutral-500">{description}</p>
    </div>
  );
}

function VisitorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="5" width="16" height="14" rx="2.5" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6.8 16c.7-1.6 3.7-1.6 4.4 0" />
      <path d="M14 10h3.2" />
      <path d="M14 14h4" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 21h16" />
      <path d="M6 21V8.5L12 4l6 4.5V21" />
      <path d="M9 21v-6h6v6" />
      <path d="M9.5 10h.01" />
      <path d="M14.5 10h.01" />
    </svg>
  );
}

function VerifyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}