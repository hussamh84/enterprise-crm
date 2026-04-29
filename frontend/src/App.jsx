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
import SalesFromInventoryPage from "./pages/SalesFromInventoryPage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";
import SearchPage from "./pages/SearchPage";
import UsersPage from "./pages/UsersPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import ReportsPage from "./pages/ReportsPage";
import SiteVisitPage from "./pages/SiteVisitPage";
import TechnicianTasksPage from "./pages/TechnicianTasksPage";
import MobileMapPage from "./pages/MobileMapPage";
import MobileVisitPage from "./pages/MobileVisitPage";
import VisitProofsPage from "./pages/VisitProofsPage";
import TechnicianHome from "./pages/mobile/TechnicianHome";
import MobileLayout from "./layouts/MobileLayout";
import { useAuthStore } from "./store/authStore";
import { isTechnician } from "./utils/roleAccess";

const __filename = import.meta.url;
console.log("CHECK PAGE:", __filename);

function AdminRoute({ technician, children }) {
  if (technician) return <Navigate to="/mobile/tasks" replace />;
  return children;
}

function App() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const technician = isTechnician(user?.role);

  return (
    <div className="relative z-[1]">
      <Routes>
        <Route path="/mobile" element={<MobileLayout />}>
          <Route index element={<Navigate to="/mobile/tasks" replace />} />
          <Route path="tasks" element={<TechnicianHome />} />
          <Route path="map" element={<MobileMapPage />} />
          <Route path="visit/:id" element={<MobileVisitPage />} />
          <Route path="visit" element={<MobileVisitPage />} />
        </Route>

        {!token ? (
          <>
            <Route path="/" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Layout />}>
              <Route index element={technician ? <Navigate to="/mobile/tasks" replace /> : <DashboardPage />} />
              <Route path="technician/tasks" element={technician ? <Navigate to="/mobile/tasks" replace /> : <TechnicianTasksPage />} />
              <Route path="site-visit" element={technician ? <Navigate to="/mobile/tasks" replace /> : <SiteVisitPage />} />
              <Route path="leads" element={<AdminRoute technician={technician}><LeadsKanbanPage /></AdminRoute>} />
              <Route path="clients" element={<AdminRoute technician={technician}><ModulePage title="Clients" endpoint="/clients" /></AdminRoute>} />
              <Route path="clients/new" element={<AdminRoute technician={technician}><CreateClientPage /></AdminRoute>} />
              <Route path="clients/:clientId/edit" element={<AdminRoute technician={technician}><EditClientPage /></AdminRoute>} />
              <Route path="clients/:clientId" element={<AdminRoute technician={technician}><ClientDetailsPage /></AdminRoute>} />
              <Route path="quotations" element={<AdminRoute technician={technician}><ModulePage title="Quotations" endpoint="/quotations" /></AdminRoute>} />
              <Route path="quotations/new" element={<AdminRoute technician={technician}><QuotationBuilderPage /></AdminRoute>} />
              <Route path="quotations/:quotationId/edit" element={<AdminRoute technician={technician}><QuotationBuilderPage /></AdminRoute>} />
              <Route path="quotations/:id" element={<AdminRoute technician={technician}><QuotationViewPage /></AdminRoute>} />
              <Route path="projects" element={<AdminRoute technician={technician}><ModulePage title="Projects" endpoint="/projects" /></AdminRoute>} />
              <Route path="projects/new" element={<AdminRoute technician={technician}><CreateProjectPage /></AdminRoute>} />
              <Route path="sales/new" element={<AdminRoute technician={technician}><SalesFromInventoryPage /></AdminRoute>} />
              <Route path="projects/:projectId" element={<AdminRoute technician={technician}><ProjectDetailsPage /></AdminRoute>} />
              <Route path="invoices" element={<AdminRoute technician={technician}><ModulePage title="Invoices" endpoint="/invoices" /></AdminRoute>} />
              <Route path="invoices/:invoiceId" element={<AdminRoute technician={technician}><InvoiceDetailPage /></AdminRoute>} />
              <Route path="search" element={<AdminRoute technician={technician}><SearchPage /></AdminRoute>} />
              <Route path="inventory" element={<AdminRoute technician={technician}><ModulePage title="Inventory" endpoint="/inventory" /></AdminRoute>} />
              <Route path="tickets" element={<AdminRoute technician={technician}><ModulePage title="Support Tickets" endpoint="/tickets" /></AdminRoute>} />
              <Route path="users" element={<AdminRoute technician={technician}><UsersPage /></AdminRoute>} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<AdminRoute technician={technician}><SettingsPage /></AdminRoute>} />
              <Route path="reports" element={<AdminRoute technician={technician}><ReportsPage /></AdminRoute>} />
              <Route path="visit-proofs" element={<AdminRoute technician={technician}><VisitProofsPage /></AdminRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </div>
  );
}

export default App;
