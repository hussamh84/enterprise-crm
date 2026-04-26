import { useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";

export default function ResetPasswordPage() {
const { token } = useParams();
const [password, setPassword] = useState("");

const handleSubmit = async (e) => {
e.preventDefault();

try {
  await api.post(`/auth/reset-password/${token}`, {
    password
  });

  alert("Password updated");
} catch (err) {
  console.error(err);
  alert("Error");
}

};

return (
<div style={{ padding: 40 }}> <h1>Reset Password</h1>

  <form onSubmit={handleSubmit}>
    <input
      type="password"
      placeholder="New password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
    />

    <button type="submit">Update Password</button>
  </form>
</div>

);
}
