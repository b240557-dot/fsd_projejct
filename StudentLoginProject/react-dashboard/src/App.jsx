import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { FileText, LayoutDashboard, LogOut, Mail, Play } from "lucide-react";
import { AuthProvider } from "./AuthContext";
import AuthPage from "./AuthPage";
import Contact from "./cont";
import Dashboard from "./Dashboard";
import InterviewHistory from "./InterviewHistory";
import InterviewSession from "./InterviewSession";
import JobDescriptionAnalysis from "./JobDescriptionAnalysis";
import Practice from "./Practice";
import { useAuth } from "./useAuth";

function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
  try {
    await logout();
    navigate("/login");
  } catch (error) {
    window.alert(error.message);
  }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/dashboard">
          <span className="brand-mark">AI</span>
          <span>Interview<span className="brand-accent">Prep</span></span>
        </Link>

        <p className="nav-label">WORKSPACE</p>
        <nav className="side-nav" aria-label="Main navigation">
          <NavLink to="/dashboard"><LayoutDashboard size={18} />Dashboard</NavLink>
          <NavLink to="/practice"><Play size={18} />Practice interview</NavLink>
          <NavLink to="/job-analysis"><FileText size={18} />Job description analysis</NavLink>
          <NavLink to="/history"><LayoutDashboard size={18} />Interview history</NavLink>
          <NavLink to="/contact"><Mail size={18} />Contact</NavLink>
        </nav>

        {user && (
          <div className="sidebar-bottom">
            <>
              <span className="user-chip">{user.username}</span>
              <button className="nav-action" onClick={handleLogout}><LogOut size={18} />Sign out</button>
            </>
          </div>
        )}
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, loading, authError, refreshUser } = useAuth();

  if (loading) return <p className="auth-loading">Checking your session...</p>;
  if (authError) {
    return (
      <main className="auth-loading">
        <p className="form-message error" role="alert">{authError}</p>
        <button className="primary-btn" onClick={refreshUser}>Retry connection</button>
      </main>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/job-analysis" element={<JobDescriptionAnalysis />} />
            <Route path="/history" element={<InterviewHistory />} />
            <Route path="/interviews/:interviewId" element={<InterviewSession />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
