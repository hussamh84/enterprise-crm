import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import "leaflet/dist/leaflet.css";
import App from "./App.jsx";
import { setAuthToken } from "./lib/api";
import { initFirebaseMessaging } from "./lib/firebaseMessaging";
import { useAuthStore } from "./store/authStore";

const queryClient = new QueryClient();
const token = useAuthStore.getState().token;
setAuthToken(token);
document.documentElement.style.setProperty("--app-bg-image", "none");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker registration failed", error);
    });
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
