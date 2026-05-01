import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import App from "./App.jsx";
import { setAuthToken } from "./lib/api";
import { useAuthStore } from "./store/authStore";

const queryClient = new QueryClient();
const token =
  useAuthStore.getState().token ||
  sessionStorage.getItem("crm_token") ||
  sessionStorage.getItem("token");
setAuthToken(token);
document.documentElement.style.setProperty("--app-bg-image", "none");

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
