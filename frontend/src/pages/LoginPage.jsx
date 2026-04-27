import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuthStore } from "../store/authStore";

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [form, setForm] = useState({ email: "admin@demo.com", password: "12345678" });
  const [error, setError] = useState("");
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
      className="login-page"
      style={{
        backgroundImage: "url('/login-bg.png')",
      }}
    >
      <div className="login-page-inner">
        <form className="login-card" onSubmit={onLogin}>
          <img
            src="/logo.png"
            onError={handleLogoError}
            alt=""
            className="login-card__logo"
          />

          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <div className="row">
            <label className="login-card__remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember me
            </label>
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
