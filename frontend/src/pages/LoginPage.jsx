import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [form, setForm] = useState({ email: "admin@demo.com", password: "12345678" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const onLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const { data } = await api.post("/auth/login", form);
      setSession(data);
      navigate("/");
    } catch (err) {
      console.warn("Login failed", err?.response?.status || err?.message);
      setError("Invalid email or password.");
    }
  };

  const handleLogoError = (event) => {
    event.currentTarget.onerror = null;
    if (!event.currentTarget.src.endsWith("/logo.png")) {
      event.currentTarget.src = "/logo.png";
      return;
    }
    event.currentTarget.src = "/favicon.svg";
  };

  return (
    <div
      className="min-h-screen relative flex items-center justify-center p-8 overflow-hidden"
      style={{
        backgroundImage: "url('/login-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
      }}
    >

      <div className="relative w-full max-w-[340px] flex items-center justify-center">
        <form
          onSubmit={onLogin}
          className="w-full rounded-3xl border border-white/35 bg-white/50 backdrop-blur-xl shadow-lg p-4 flex flex-col gap-2 scale-90"
        >
          <div className="flex justify-center mb-1">
            <img
              src="/logo.png"
              onError={handleLogoError}
              alt="Config Engineering Logo"
              className="w-56 h-56 mx-auto mt-2 mb-2 object-contain"
            />
          </div>

          <div className="flex flex-col items-center mb-1 gap-1">
            <h1 className="text-sm font-medium tracking-widest text-center">LOGIN</h1>
            <span className="h-[2px] w-7 rounded-full bg-[#8d95a8]/70" />
          </div>

          <div className="w-full mx-auto space-y-2">
            <div className="space-y-1.5">
              <label className="text-[16px] leading-none font-normal text-[#6b7489]">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#7c8598]" />
                <input
                  className="w-full h-[36px] rounded-full bg-white/82 border border-white/90 text-base pl-11 pr-6 text-[#515a6f] outline-none focus:ring-2 focus:ring-white/70"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  type="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[16px] leading-none font-normal text-[#6b7489]">Password</label>
              <div className="relative w-full">
                <Lock size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#7c8598]" />
                <input
                  className="w-full h-[36px] rounded-full bg-white/82 border border-white/90 text-base pl-11 pr-14 text-[#515a6f] outline-none focus:ring-2 focus:ring-white/70"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-[#788197] hover:text-[#59627a] transition-colors cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>
            </div>

            <div className="w-full flex items-center justify-between text-[16px] text-[#6b7489] pt-1">
              <label className="inline-flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-5 w-5 rounded-md border-[#8f98ad] text-[#7680a0]"
                />
                <span>Remember me</span>
              </label>
              <a href="/forgot-password" className="hover:underline">
                Forgot Password?
              </a>
            </div>

            {error && <p className="w-full text-sm text-red-500 text-center">{error}</p>}

            <button className="mx-auto mt-1 block w-full h-[36px] rounded-full text-white text-sm tracking-[0.18em] bg-gradient-to-r from-[#5f8dff] to-[#5d6bff] hover:brightness-110 transition">
              SIGN IN
            </button>

            <p className="text-[11px] text-[#8a93a5] text-center pt-1">Secure • Reliable • Professional</p>
          </div>
        </form>
      </div>
    </div>
  );
}
