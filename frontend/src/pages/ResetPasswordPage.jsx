import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../lib/api";

export default function ResetPasswordPage() {
  const { token = "" } = useParams();
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!token) {
      setError("Reset token is missing.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { data } = await api.post(`/auth/reset-password/${encodeURIComponent(token)}`, { newPassword });
      setMessage(data?.message || "Password reset successful.");
      setNewPassword("");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
      <form onSubmit={onSubmit} className="premium-card w-full max-w-sm p-5 space-y-3">
        <h1 className="text-lg font-semibold text-[#0a2540]">Reset password</h1>
        <input
          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#d6e4ff]"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password"
          type="password"
        />
        {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#635bff] text-white rounded-md py-2 text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
        >
          {isSubmitting ? "Updating..." : "Reset password"}
        </button>
        <p className="text-xs text-[#425466]">
          Back to{" "}
          <Link to="/" className="hover:underline">
            sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
