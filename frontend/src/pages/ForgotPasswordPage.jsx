import { useState } from "react";
import api from "../lib/api";

export default function ForgotPasswordPage() {
  console.log("PAGE LOADED");

  const [email, setEmail] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("FORM SUBMITTED");

    try {
      await api.post("/auth/forgot-password", { email });
      alert("Request sent");
    } catch (err) {
      console.error(err);
      alert("Error");
    }
  };

  return (
  <div style={{
    padding: 40,
    maxWidth: 400,
    margin: "100px auto",
    background: "white",
    borderRadius: "12px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.1)"
  }}>
    <h1 style={{ marginBottom: 20 }}>Forgot Password</h1>

    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="Enter email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          width: "100%",
          padding: "12px",
          marginBottom: "20px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          fontSize: "16px"
        }}
      />

      <button
        type="submit"
        style={{
          width: "100%",
          padding: "12px",
          background: "#4f46e5",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontSize: "16px",
          cursor: "pointer"
        }}
      >
        Send Reset Link
      </button>
    </form>
  </div>
);
}
