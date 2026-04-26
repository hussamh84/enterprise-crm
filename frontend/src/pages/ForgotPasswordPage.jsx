import { useState } from "react";
import axios from "axios";

export default function ForgotPasswordPage() {
console.log("PAGE LOADED");
const [email, setEmail] = useState("");

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
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    background: "red",
    color: "white",
    zIndex: 999999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "40px"
  }}>
    REAL PAGE LOADED
  </div>

);
}
