import { create } from "zustand";
import { setAuthToken } from "../lib/api";

const readStoredToken = () => localStorage.getItem("crm_token") || localStorage.getItem("token");

export const useAuthStore = create((set) => ({
  token: readStoredToken(),
  user: JSON.parse(localStorage.getItem("crm_user") || "null"),
  setSession: ({ token, user }) => {
    localStorage.setItem("crm_token", token);
    localStorage.setItem("token", token);
    localStorage.setItem("crm_user", JSON.stringify(user));
    setAuthToken(token);
    set({ token, user });
  },
  updateUser: (partial) =>
    set((state) => {
      const next = state.user ? { ...state.user, ...partial } : partial;
      if (next && typeof next === "object") {
        localStorage.setItem("crm_user", JSON.stringify(next));
      }
      return { user: next };
    }),
  clearSession: () => {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("token");
    localStorage.removeItem("crm_user");
    setAuthToken(null);
    set({ token: null, user: null });
  },
}));
