import { Routes, Route, Navigate, Outlet } from "react-router-dom";

// Layouts
import MainLayout from "@/layouts/MainLayout"; 

// Pages
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Editor from "@/pages/Editor";

const useAuth = () => {
  const user = { loggedIn: true}; // Toggle this to false to test login
  return user.loggedIn;
};

const ProtectedRoutes = () => {
  const isAuth = useAuth();
  return isAuth ? <Outlet /> : <Navigate to="/login" />;
};

function App() {
  return (
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
          <Route path="/components" element={<div>Components Page</div>} />
        </Route>

        {/* Editor Layout */}
        <Route path="/editor/:projectId" element={<Editor />} />
      </Route>
    </Routes>
  );
}

export default App;