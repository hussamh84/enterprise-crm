import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) {
      setError("Please provide a valid name, email, and password (min 6 chars).");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post("/auth/register", {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || "Could not create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
      <form onSubmit={onSubmit} className="premium-card w-full max-w-sm p-5 space-y-3">
        <h1 className="text-lg font-semibold text-[#0a2540]">Create account</h1>
        <input
          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#d6e4ff]"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Name"
        />
        <input
          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#d6e4ff]"
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          placeholder="Email"
          type="email"
        />
        <input
          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#d6e4ff]"
          value={form.password}
          onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          placeholder="Password"
          type="password"
        />
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#635bff] text-white rounded-md py-2 text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
        >
          {isSubmitting ? "Creating..." : "Register"}
        </button>
        <p className="text-xs text-[#425466]">
          Already have an account?{" "}
          <Link to="/" className="hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
