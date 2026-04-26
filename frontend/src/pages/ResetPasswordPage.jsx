import { useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";

export default function ResetPasswordPage() {
const { token } = useParams();
const [password, setPassword] = useState("");
const [loading, setLoading] = useState(false);

const handleSubmit = async (e) => {
e.preventDefault();

console.log("RESET SUBMITTED");

try {
  setLoading(true);

  await api.post(`/auth/reset-password/${token}`, {
    password
  });

  alert("Password updated successfully");

} catch (err) {
  console.error(err);
  alert("Error updating password");
} finally {
  setLoading(false);
}

};

return (
<div style={{
display: "flex",
justifyContent: "center",
alignItems: "center",
height: "100vh",
background: "#f5f7fa"
}}>
<div style={{
width: "350px",
background: "white",
padding: "30px",
borderRadius: "12px",
boxShadow: "0 10px 30px rgba(0,0,0,0.1)"
}}>
<h2 style={{ marginBottom: "20px" }}>Reset Password</h2>

    <form onSubmit={handleSubmit}>
      <input
        type="password"
        placeholder="Enter new password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{
          width: "100%",
          padding: "12px",
          marginBottom: "20px",
          borderRadius: "8px",
          border: "1px solid #ccc"
        }}
      />

      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%",
          padding: "12px",
          background: loading ? "#999" : "#4f46e5",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer"
        }}
      >
        {loading ? "Updating..." : "Update Password"}
      </button>
    </form>
  </div>
</div>

);
}
