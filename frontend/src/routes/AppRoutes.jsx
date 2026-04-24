import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import AdminPanel from "../pages/AdminPanel";
import AdminProducts from "../pages/AdminProducts";
import AdminStock from "../pages/AdminStock";
import UserPanel from "../pages/UserPanel";
import UpdateStock from "../pages/UpdateStock";
import Register from "../pages/Register";
import AdminUsers from "../pages/AdminUsers";
import InventoryItems from "../pages/InventoryItems";
import ManufacturingList from "../pages/ManufacturingList";
import ManufacturingDetail from "../pages/ManufacturingDetail";

import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Synchronizing Security...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={["admin", "super_admin"].includes(user.role) ? "/admin" : "/user"} replace />;
  }
  
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Initializing...</div>;
  if (user) return <Navigate to={["admin", "super_admin"].includes(user.role) ? "/admin" : "/user"} replace />;
  
  return children;
};

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        <Route path="/login" element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } />
        
        <Route path="/register" element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
            <AdminPanel />
          </ProtectedRoute>
        } />
        
        <Route path="/admin/products" element={
          <ProtectedRoute allowedRoles={["admin", "super_admin", "user"]}>
            <AdminProducts />
          </ProtectedRoute>
        } />
        
        <Route path="/admin/stock" element={
          <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
            <AdminStock />
          </ProtectedRoute>
        } />
        
        <Route path="/admin/users" element={
          <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
            <AdminUsers />
          </ProtectedRoute>
        } />

        <Route path="/admin/inventory-items" element={
          <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
            <InventoryItems />
          </ProtectedRoute>
        } />

        <Route path="/admin/manufacturing" element={
          <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
            <ManufacturingList />
          </ProtectedRoute>
        } />

        <Route path="/admin/manufacturing/:id" element={
          <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
            <ManufacturingDetail />
          </ProtectedRoute>
        } />

        <Route path="/admin/stock/updates" element={
          <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
            <UpdateStock />
          </ProtectedRoute>
        } />
        
        <Route path="/user" element={
          <ProtectedRoute allowedRoles={["user", "admin", "super_admin"]}>
            <UserPanel />
          </ProtectedRoute>
        } />

        <Route path="/user/analytics" element={
          <ProtectedRoute allowedRoles={["user", "admin", "super_admin"]}>
            <AdminPanel />
          </ProtectedRoute>
        } />
        
        <Route path="/user/stock" element={
          <ProtectedRoute allowedRoles={["user", "admin", "super_admin"]}>
            <UpdateStock />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;