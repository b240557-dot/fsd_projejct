import { Navigate, Outlet } from "react-router-dom";

function ProtectedLayout() {
  const token = localStorage.getItem("token");

  // User logged in nahi hai
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // User logged in hai
  return <Outlet />;
}

export default ProtectedLayout;