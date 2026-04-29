import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import ModulePage from "./pages/ModulePage";
import ClientsPage from "./pages/ClientsPage";
import UsersPage from "./pages/UsersPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import ReportsPage from "./pages/ReportsPage";
import CreateClientPage from "./pages/CreateClientPage";
import EditClientPage from "./pages/EditClientPage";
import ClientDetailsPage from "./pages/ClientDetailsPage";
import ProjectDetailsPage from "./pages/ProjectDetailsPage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";
import SalesFromInventoryPage from "./pages/SalesFromInventoryPage";
import InventoryPage from "./pages/InventoryPage";
import InvoicePage from "./pages/InvoicePage";
import LeadsPage from "./pages/LeadsPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/new" element={<CreateClientPage />} />
        <Route path="clients/:clientId/edit" element={<EditClientPage />} />
        <Route path="clients/:clientId" element={<ClientDetailsPage />} />
        <Route path="projects" element={<ModulePage title="Projects" endpoint="/projects" />} />
        <Route path="projects/:projectId" element={<ProjectDetailsPage />} />
        <Route path="invoices" element={<InvoicePage />} />
        <Route path="invoices/:invoiceId" element={<InvoiceDetailPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="sales/new" element={<SalesFromInventoryPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
