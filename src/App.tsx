import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import DashboardLayout from "./components/DashboardLayout";
import AuthPage from "./pages/AuthPage";
import RegistrationPage from "./pages/RegistrationPage";
import DashboardHome from "./pages/DashboardHome";
import StudentManagement from "./pages/StudentManagement";
import TaskLedger from "./pages/TaskLedger";
import ReportsPage from "./pages/ReportsPage";
import EcaReportPage from "./pages/EcaReportPage";
import AdminSettings from "./pages/AdminSettings";
import StaffChat from "./pages/StaffChat";
import StudentPortal from "./pages/StudentPortal";

const ProtectedRoute = ({ children, requireAdmin = false }: any) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex bg-slate-50 min-h-screen items-center justify-center"><p className="text-slate-500 font-medium">Checking authentication...</p></div>;
  if (!user) return <Navigate to="/login" replace />;

  if (requireAdmin && user.appRole !== "admin") return <Navigate to="/" replace />;

  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<RegistrationPage />} />
        <Route path="/student-portal" element={<StudentPortal />} />
        
        <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<DashboardHome />} />
          <Route path="students" element={<StudentManagement />} />
          <Route path="ledger" element={<TaskLedger />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="eca-reports" element={<EcaReportPage />} />
          <Route path="chat" element={<StaffChat />} />
          <Route path="settings" element={<ProtectedRoute requireAdmin><AdminSettings /></ProtectedRoute>} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
