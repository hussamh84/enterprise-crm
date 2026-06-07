import { useEffect } from "react";
import { setAuthToken } from "../lib/api";

const applyPrintAuthToken = () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("access_token") || "";
  if (!token) return "";
  sessionStorage.setItem("crm_token", token);
  sessionStorage.setItem("token", token);
  setAuthToken(token);
  return token;
};

export function usePrintAuthToken() {
  useEffect(() => {
    applyPrintAuthToken();
  }, []);
}

applyPrintAuthToken();
