import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { onCompanyLogoImgError } from "../config/company";
import api from "../lib/api";
import { useCompanyBrandingSnapshot } from "../lib/companySettings";
import { useAuthStore } from "../store/authStore";

export default function LoginPage() {
  const navigate = useNavigate();
  const sessionToken = useAuthStore((s) => s.token);
  const setSession = useAuthStore((s) => s.setSession);
  const branding = useCompanyBrandingSnapshot(null);
  const [form, setForm] = useState({ email: "admin@demo.com", password: "12345678" });
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    document.title = branding.companyName;
  }, [branding.companyName]);

  useEffect(() => {
    if (sessionToken) navigate("/", { replace: true });
  }, [sessionToken, navigate]);

  const onLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const response = await api.post("/auth/login", form);
      setSession(response.data);
      navigate("/");
    } catch (err) {
      console.warn("Login failed", err?.response?.status || err?.message);
      setError("Invalid email or password.");
    }
  };

  const togglePassword = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <div
      className="login-page"
      style={{
        backgroundImage: "url('/login-bg.png')",
      }}
    >
      <div className="login-page-inner">
        <form className="login-card" onSubmit={onLogin}>
          <img src={branding.logo} onError={onCompanyLogoImgError} alt="" />

          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <label htmlFor="password">Password</label>
          <div className="password-wrapper">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              className="toggle-eye"
              onClick={togglePassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} strokeWidth={2} aria-hidden /> : <Eye size={18} strokeWidth={2} aria-hidden />}
            </button>
          </div>

          <div className="row">
            <div className="remember">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="remember">Remember me</label>
            </div>
            <a className="login-card__forgot" href="/forgot-password">
              Forgot Password?
            </a>
          </div>

          {error ? <p className="login-card__error">{error}</p> : null}

          <button type="submit">SIGN IN</button>
        </form>
      </div>
    </div>
  );
}
