import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import App from "./App.jsx";
import { setAuthToken } from "./lib/api";
import { initFirebaseMessaging } from "./lib/firebaseMessaging";
import { useAuthStore } from "./store/authStore";

const queryClient = new QueryClient();
const token = useAuthStore.getState().token || localStorage.getItem("token");
setAuthToken(token);
document.documentElement.style.setProperty("--app-bg-image", "none");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch (error) {
      console.warn("Service worker cleanup failed", error);
    }
  });
}

initFirebaseMessaging();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
