import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import ModulePage from "./pages/ModulePage";
import ClientsPage from "./pages/ClientsPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="projects" element={<ModulePage title="Projects" endpoint="/projects" />} />
        <Route path="invoices" element={<ModulePage title="Invoices" endpoint="/invoices" />} />
        <Route path="inventory" element={<ModulePage title="Inventory" endpoint="/inventory" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
