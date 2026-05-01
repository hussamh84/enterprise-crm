import { create } from "zustand";
import { setAuthToken } from "../lib/api";

/** Session-only auth: cleared when the browser session ends (tab/window closed). */
const readStoredToken = () => sessionStorage.getItem("crm_token") || sessionStorage.getItem("token");

function stripLegacyAuthStorage() {
  localStorage.removeItem("crm_token");
  localStorage.removeItem("token");
  localStorage.removeItem("crm_user");
}

export const useAuthStore = create((set) => ({
  token: readStoredToken(),
  user: JSON.parse(sessionStorage.getItem("crm_user") || "null"),
  setSession: ({ token, user }) => {
    stripLegacyAuthStorage();
    sessionStorage.setItem("crm_token", token);
    sessionStorage.setItem("token", token);
    sessionStorage.setItem("crm_user", JSON.stringify(user));
    setAuthToken(token);
    set({ token, user });
  },
  updateUser: (partial) =>
    set((state) => {
      const next = state.user ? { ...state.user, ...partial } : partial;
      if (next && typeof next === "object") {
        sessionStorage.setItem("crm_user", JSON.stringify(next));
      }
      return { user: next };
    }),
  clearSession: () => {
    stripLegacyAuthStorage();
    sessionStorage.clear();
    setAuthToken(null);
    set({ token: null, user: null });
  },
}));
