"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function LoginPortal() {
  const router = useRouter();
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  // Form States
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(""); // New state for phone number linking
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  
  // Loading State for professional UI feel
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // If user session already exists, redirect automatically
    const currentUser = window.localStorage.getItem("lotte_web2_user");
    if (currentUser) {
      const user = JSON.parse(currentUser);
      if (user.role === "admin") router.push("/admin");
      else router.push("/visitor");
    }
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    setTimeout(() => {
      if (isLoginMode) {
        // --- LOGIN LOGIC ---
        if (email === "admin@lotte.com" && password === "admin123") {
          // Handle Admin Login
          const adminSession = { role: "admin", name: "Lotte Admin", email };
          window.localStorage.setItem("lotte_web2_user", JSON.stringify(adminSession));
          router.push("/admin");
        } else {
          // Handle Visitor Login
          const savedUsers = JSON.parse(window.localStorage.getItem("lotte_users_db") || "[]");
          const foundUser = savedUsers.find((u: any) => u.email === email && u.password === password);
          
          if (foundUser) {
            const userSession = { role: "visitor", name: foundUser.name, email, phone: foundUser.phone };
            window.localStorage.setItem("lotte_web2_user", JSON.stringify(userSession));
            router.push("/visitor");
          } else {
            setErrorMsg("❌ Invalid email or password.");
          }
        }
      } else {
        // --- REGISTER LOGIC (Visitor Only) ---
        if (!name || !phone || !email || !password) {
          setErrorMsg("❌ Please fill in all required fields.");
          setIsLoading(false);
          return;
        }

        const savedUsers = JSON.parse(window.localStorage.getItem("lotte_users_db") || "[]");
        const isExist = savedUsers.find((u: any) => u.email === email);
        
        if (isExist) {
          setErrorMsg("❌ This email address is already registered.");
        } else {
          const newUser = { name, phone, email, password };
          savedUsers.push(newUser);
          window.localStorage.setItem("lotte_users_db", JSON.stringify(savedUsers));
          
          // Auto-login upon successful registration
          const userSession = { role: "visitor", name, email, phone };
          window.localStorage.setItem("lotte_web2_user", JSON.stringify(userSession));
          router.push("/visitor");
        }
      }
      setIsLoading(false);
    }, 1000); // Simulated network delay
  };

  return (
    <main className="min-h-screen bg-[#fff8f6] text-[#151515] flex flex-col">
      {/* Background Decor */}
      <div className="fixed left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-[#E30613]/10 blur-3xl" />
      <div className="fixed bottom-[-180px] right-[-120px] h-[480px] w-[480px] rounded-full bg-[#E30613]/10 blur-3xl" />
      
      {/* HEADER WITH AUTH TOGGLE NAVIGATION */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6 w-full max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E30613] text-xl font-black text-white shadow-lg">L</div>
          <span className="font-black tracking-widest text-[#E30613] text-sm">LOTTE MALL</span>
        </div>
        
        <button 
          onClick={() => {
            setIsLoginMode(!isLoginMode);
            setErrorMsg("");
          }}
          className="rounded-full border border-red-200 bg-white/80 px-6 py-2.5 text-sm font-black text-[#E30613] shadow-sm backdrop-blur transition hover:bg-[#fff4f1]"
        >
          {isLoginMode ? "Create New Account" : "Already have an account? Sign In"}
        </button>
      </header>

      {/* FORM WINDOW */}
      <section className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-[2.5rem] border border-red-100 bg-white p-10 shadow-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-black tracking-tight">{isLoginMode ? "Sign In" : "Sign Up"}</h1>
            <p className="mt-2 text-sm font-medium text-neutral-500">
              {isLoginMode ? "Access the decentralized identity authentication gateway." : "Create your off-chain Web2 user profile."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLoginMode && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-neutral-500 uppercase tracking-wider">Full Name</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full rounded-2xl border border-neutral-200 bg-[#fffaf8] px-5 py-4 text-sm font-semibold outline-none transition focus:border-[#E30613] focus:ring-4 focus:ring-red-50"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-neutral-500 uppercase tracking-wider">Phone Number</label>
                  <input 
                    type="text" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0912345678"
                    className="w-full rounded-2xl border border-neutral-200 bg-[#fffaf8] px-5 py-4 text-sm font-semibold outline-none transition focus:border-[#E30613] focus:ring-4 focus:ring-red-50"
                  />
                </div>
              </>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-bold text-neutral-500 uppercase tracking-wider">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@lotte.com or your email"
                className="w-full rounded-2xl border border-neutral-200 bg-[#fffaf8] px-5 py-4 text-sm font-semibold outline-none transition focus:border-[#E30613] focus:ring-4 focus:ring-red-50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-neutral-500 uppercase tracking-wider">Password</label>
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-neutral-200 bg-[#fffaf8] px-5 py-4 text-sm font-semibold outline-none transition focus:border-[#E30613] focus:ring-4 focus:ring-red-50"
              />
            </div>

            {errorMsg && (
              <div className="rounded-xl bg-red-50 p-3 text-center text-sm font-bold text-red-600 border border-red-100">
                {errorMsg}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="mt-4 flex w-full items-center justify-center rounded-2xl bg-[#E30613] py-4 text-base font-black text-white shadow-xl shadow-red-200 transition hover:-translate-y-1 hover:bg-[#bd000a] disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {isLoading ? "Processing..." : (isLoginMode ? "Sign In to System" : "Complete Registration")}
            </button>
          </form>

          {isLoginMode && (
             <div className="mt-8 rounded-2xl bg-neutral-50 p-4 text-center border border-neutral-200">
               <p className="text-xs font-black uppercase text-neutral-400">Admin Test Credentials</p>
               <p className="mt-1 text-sm font-bold text-neutral-700">admin@lotte.com / admin123</p>
             </div>
          )}
        </div>
      </section>
    </main>
  );
}