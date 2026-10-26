import { Routes, Route, Navigate } from "react-router-dom";

// Auth pages
import Login from "./pages/Login";
import Signup from "./pages/Signup";

// Main pages
import Dashboard from "./pages/Dashboard";
import CreateInterview from "./pages/CreateInterview";
import InterviewInstructions from "./pages/InterviewInstructions";
import LiveInterview from "./pages/LiveInterview";
import InterviewResult from "./pages/InterviewResult";
import QuestionAnalysis from "./pages/QuestionAnalysis";
import Performance from "./pages/Performance";
import InterviewHistory from "./pages/InterviewHistory";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";

// Layout
import ProtectedLayout from "./components/ProtectedLayout";

function App() {
  return (
    <Routes>
      {/* Public routes */}

      <Route
        path="/"
        element={<Navigate to="/login" replace />}
      />

      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/signup"
        element={<Signup />}
      />

      {/* Protected routes */}

      <Route element={<ProtectedLayout />}>
        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        <Route
          path="/create-interview"
          element={<CreateInterview />}
        />

        <Route
          path="/interview-instructions"
          element={<InterviewInstructions />}
        />

        <Route
          path="/live-interview"
          element={<LiveInterview />}
        />

        <Route
          path="/result"
          element={<InterviewResult />}
        />

        <Route
          path="/result/questions"
          element={<QuestionAnalysis />}
        />

        <Route
          path="/performance"
          element={<Performance />}
        />

        <Route
          path="/history"
          element={<InterviewHistory />}
        />

        <Route
          path="/profile"
          element={<Profile />}
        />

        <Route
          path="/settings"
          element={<Settings />}
        />
      </Route>

      {/* Unknown route */}

      <Route
        path="*"
        element={<Navigate to="/login" replace />}
      />
    </Routes>
  );
}

export default App;