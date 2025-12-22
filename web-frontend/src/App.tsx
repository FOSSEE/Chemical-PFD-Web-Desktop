import { Routes, Route, Navigate, Outlet } from "react-router-dom";

// Layouts
import MainLayout from "@/layouts/MainLayout";

// Pages
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Editor from "@/pages/Editor";
import ReportsPage from "@/pages/Reports";
import Components from "@/pages/Components";

// Context
import { ComponentProvider } from "@/context/ComponentContext";

const useAuth = () => {
  const user = { loggedIn: true }; // Toggle this to false to test login
  return user.loggedIn;
};

const ProtectedRoutes = () => {
  const isAuth = useAuth();
  return isAuth ? <Outlet /> : <Navigate to="/login" />;
};

function App() {
  return (
    <ComponentProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoutes />}>
          {/* Main Layout */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/components" element={<Components />} />
          </Route>

          {/* Editor Layout */}
          <Route path="/editor/:projectId" element={<Editor />} />
        </Route>

        {/* Other Routes */}
        {/* <Route path="/reports" element={<ReportsPage />} /> */}
      </Routes>
    </ComponentProvider>
  );
}

export default App;