import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { onCompanyLogoImgError } from "../config/company";
import api from "../lib/api";
import { useCompanyBrandingSnapshot } from "../lib/companySettings";

export default function ResetPasswordPage() {
  const branding = useCompanyBrandingSnapshot(null);
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    document.title = branding.companyName;
  }, [branding.companyName]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      await api.post(`/auth/reset-password/${token}`, { password });
      setSuccess("Password updated successfully. Redirecting to login...");
      setTimeout(() => navigate("/login"), 900);
    } catch (err) {
      console.error(err);
      setError("Error updating password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "#f5f7fa",
      }}
    >
      <div
        style={{
          width: "350px",
          background: "white",
          padding: "30px",
          borderRadius: "12px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
        }}
      >
        <img
          src={branding.logo}
          onError={onCompanyLogoImgError}
          alt=""
          style={{ maxHeight: "48px", width: "auto", marginBottom: "16px", objectFit: "contain" }}
        />
        <h2 style={{ marginBottom: "20px" }}>Reset Password</h2>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "15px",
              borderRadius: "8px",
              border: "1px solid #ccc",
            }}
          />

          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "20px",
              borderRadius: "8px",
              border: "1px solid #ccc",
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              background: loading ? "#999" : "var(--secondary-color, #4f46e5)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
          {error ? <p style={{ marginTop: "12px", color: "#dc2626", fontSize: "14px" }}>{error}</p> : null}
          {success ? <p style={{ marginTop: "12px", color: "#16a34a", fontSize: "14px" }}>{success}</p> : null}
        </form>
      </div>
    </div>
  );
}
