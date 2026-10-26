import { Navigate, Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

function ProtectedLayout() {
  // Temporary:
  const isLoggedIn = true;

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default ProtectedLayout;