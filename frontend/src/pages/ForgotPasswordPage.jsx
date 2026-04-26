import { useState } from "react";
import axios from "axios";

export default function ForgotPasswordPage() {
  console.log("PAGE LOADED");

  const [email, setEmail] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("FORM SUBMITTED");

    try {
      await axios.post("/api/v1/auth/forgot-password", { email });
      alert("Request sent");
    } catch (err) {
      console.error(err);
      alert("Error");
    }
  };

  return (
<div style={{ padding: 40 }}> <h1>Forgot Password</h1>

    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="Enter email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: "block", marginBottom: 20, padding: 10 }}
      />

      <button type="submit">Send Reset Link</button>
    </form>
  </div>
);
}
