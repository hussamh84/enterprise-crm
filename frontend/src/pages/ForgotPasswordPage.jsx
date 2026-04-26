import { useState } from "react";
import axios from "axios";

export default function ForgotPasswordPage() {
const [email, setEmail] = useState("");

const handleSubmit = async (e) => {
e.preventDefault();

console.log("FORGOT PASSWORD CLICKED");

try {
  await axios.post("/api/v1/auth/forgot-password", {
    email
  });

  alert("If email exists, reset link sent");

} catch (err) {
  console.error(err);
  alert("Error");
}

};

return (
<div style={{ padding: 40 }}> <h2>Forgot Password</h2>

  <form onSubmit={handleSubmit}>
    <input
      type="email"
      placeholder="Enter your email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
    />

    <button type="submit">Send Reset Link</button>
  </form>
</div>

);
}
