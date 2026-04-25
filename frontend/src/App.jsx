import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import ModulePage from "./pages/ModulePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import LeadsKanbanPage from "./pages/LeadsKanbanPage";
import ProjectDetailsPage from "./pages/ProjectDetailsPage";
import ClientDetailsPage from "./pages/ClientDetailsPage";
import CreateClientPage from "./pages/CreateClientPage";
import EditClientPage from "./pages/EditClientPage";
import QuotationBuilderPage from "./pages/QuotationBuilderPage";
import QuotationViewPage from "./pages/QuotationViewPage";
import CreateProjectPage from "./pages/CreateProjectPage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";
import UsersPage from "./pages/UsersPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import ReportsPage from "./pages/ReportsPage";
import { useAuthStore } from "./store/authStore";

function App() {
  const token = useAuthStore((s) => s.token);
  if (!token) {
    return (
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="leads" element={<LeadsKanbanPage />} />
        <Route path="clients" element={<ModulePage title="Clients" endpoint="/clients" />} />
        <Route path="clients/new" element={<CreateClientPage />} />
        <Route path="clients/:clientId/edit" element={<EditClientPage />} />
        <Route path="clients/:clientId" element={<ClientDetailsPage />} />
        <Route path="quotations" element={<ModulePage title="Quotations" endpoint="/quotations" />} />
        <Route path="quotations/new" element={<QuotationBuilderPage />} />
        <Route path="quotations/:quotationId/edit" element={<QuotationBuilderPage />} />
        <Route path="quotations/:id" element={<QuotationViewPage />} />
        <Route path="projects" element={<ModulePage title="Projects" endpoint="/projects" />} />
        <Route path="projects/new" element={<CreateProjectPage />} />
        <Route path="projects/:projectId" element={<ProjectDetailsPage />} />
        <Route path="invoices" element={<ModulePage title="Invoices" endpoint="/invoices" />} />
        <Route path="invoices/:invoiceId" element={<InvoiceDetailPage />} />
        <Route path="inventory" element={<ModulePage title="Inventory" endpoint="/inventory" />} />
        <Route path="tickets" element={<ModulePage title="Support Tickets" endpoint="/tickets" />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
