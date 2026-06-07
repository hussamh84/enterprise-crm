import { Navigate, Route, Routes, useParams } from "react-router-dom";
import Layout from "./components/Layout";
import { useAuthStore } from "./store/authStore";
import { isAdminRole } from "./utils/roleUtils";
import DashboardPage from "./pages/DashboardPage";
import ModulePage from "./pages/ModulePage";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ClientsPage from "./pages/ClientsPage";
import UsersPage from "./pages/UsersPage";
import SettingsPage from "./pages/SettingsPage";
import CompanySettingsPage from "./pages/CompanySettingsPage";
import BackupRestorePage from "./pages/BackupRestorePage";
import ProfilePage from "./pages/ProfilePage";
import ReportsPage from "./pages/ReportsPage";
import CreateClientPage from "./pages/CreateClientPage";
import EditClientPage from "./pages/EditClientPage";
import ClientDetailsPage from "./pages/ClientDetailsPage";
import ProjectDetailsPage from "./pages/ProjectDetailsPage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";
import SalesFromInventoryPage from "./pages/SalesFromInventoryPage";
import InventoryPage from "./pages/InventoryPage";
import InventoryDetailsPage from "./pages/InventoryDetailsPage";
import InvoicePage from "./pages/InvoicePage";
import LeadsPage from "./pages/LeadsPage";
import QuotationsPage from "./pages/QuotationsPage";
import QuotationBuilderPage from "./pages/QuotationBuilderPage";
import QuotationViewPage from "./pages/QuotationViewPage";
import QuotationPrintPage from "./pages/QuotationPrintPage";
import InvoicePrintPage from "./pages/InvoicePrintPage";

function App() {
  return (
    <Routes>
      <Route path="/print/quotations/:id" element={<QuotationPrintPage />} />
      <Route path="/print/invoices/:invoiceId" element={<InvoicePrintPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/quotations" element={<QuotationsPage />} />
        <Route path="/quotations/new" element={<QuotationBuilderPage />} />
        <Route path="/quotations/:quotationId/edit" element={<QuotationBuilderPage />} />
        <Route path="/quotations/:id" element={<QuotationViewPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/new" element={<CreateClientPage />} />
        <Route path="clients/:id/:tab" element={<ClientDetailsPage />} />
        <Route path="clients/:id" element={<ClientDetailsPage />} />
        <Route path="clients/:clientId/edit" element={<EditClientPage />} />
        <Route path="clients/:clientId" element={<ClientLegacyRedirect />} />
        <Route path="projects" element={<ModulePage title="Projects" endpoint="/projects" />} />
        <Route path="projects/:projectId" element={<ProjectDetailsPage />} />
        <Route path="invoices" element={<InvoicePage />} />
        <Route path="invoices/:invoiceId" element={<InvoiceDetailPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="inventory/:inventoryId" element={<InventoryDetailsPage />} />
        <Route path="sales/new" element={<SalesFromInventoryPage />} />
        <Route path="users" element={<RequireAdmin><UsersPage /></RequireAdmin>} />
        <Route path="settings" element={<RequireAdmin><SettingsPage /></RequireAdmin>} />
        <Route path="settings/backup" element={<RequireAdmin><BackupRestorePage /></RequireAdmin>} />
        <Route path="company-settings" element={<RequireAdmin><CompanySettingsPage /></RequireAdmin>} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="reports" element={<RequireAdmin><ReportsPage /></RequireAdmin>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

function ClientLegacyRedirect() {
  const { clientId } = useParams();
  return <Navigate to={`/clients/${clientId}/overview`} replace />;
}

function RequireAdmin({ children }) {
  const user = useAuthStore((s) => s.user);
  if (!isAdminRole(user?.role)) return <Navigate to="/" replace />;
  return children;
}
