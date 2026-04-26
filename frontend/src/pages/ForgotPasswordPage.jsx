import { useEffect, useState } from "react";
import axios from "axios";

export default function ForgotPasswordPage() {
  console.log("PAGE LOADED");
  const [email, setEmail] = useState("");

  useEffect(() => {
    document.body.style.pointerEvents = "auto";
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log("FORM SUBMITTED");

    try {
      await axios.post("/api/v1/auth/forgot-password", {
        email
      });

      alert("Request sent");

    } catch (err) {
      console.error(err);
      alert("Error");
    }

  };

  return (
  <div style={{
    padding: 40
  }}>
    <h2>Forgot Password</h2>
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        type="submit"
        onClick={() => console.log("BUTTON CLICKED")}
      >
        Send Reset Link
      </button>
    </form>
  </div>

);
}
