import { useState } from "react";
import api from "../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      alert("Request sent");
    } catch (err) {
      console.error(err);
      setError("Unable to send reset link. Try again.");
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
        <form className="login-card" onSubmit={handleSubmit}>
          <img src="/logo.png" onError={handleLogoError} alt="" />

          <h1>Forgot Password</h1>

          <label htmlFor="forgot-email">Email</label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {error ? <p className="login-card__error">{error}</p> : null}

          <button type="submit">Send Reset Link</button>
        </form>
      </div>
    </div>
  );
}
