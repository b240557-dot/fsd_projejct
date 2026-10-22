import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Brain, Target, Trophy, TrendingUp } from "lucide-react";
import { api } from "./api";
import StatCard from "./components/StatCard";

function Dashboard() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getInterviews()
      .then((result) => setInterviews(result.interviews))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const completed = useMemo(
    () => interviews.filter((interview) => interview.status === "completed"),
    [interviews],
  );
  const average = completed.length
    ? Math.round(completed.reduce((sum, item) => sum + Number(item.total_score), 0) / completed.length)
    : 0;
  const best = completed.length
    ? Math.max(...completed.map((item) => Number(item.total_score)))
    : 0;
  const recent = interviews.slice(0, 4);

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">YOUR PREPARATION</span>
          <h1>Interview dashboard</h1>
          <p>Track your practice and build confidence for your next interview.</p>
        </div>
        <button className="primary-btn" onClick={() => navigate("/practice")}>
          <Brain size={20} />Start interview
        </button>
      </div>

      {error && <p className="form-message error" role="alert">{error}</p>}

      <div className="stats-grid">
        <StatCard title="Total interviews" value={loading ? "…" : interviews.length} icon={<Brain size={22} />} />
        <StatCard title="Completed" value={loading ? "…" : completed.length} icon={<Target size={22} />} />
        <StatCard title="Average score" value={loading ? "…" : `${average}%`} icon={<TrendingUp size={22} />} />
        <StatCard title="Best score" value={loading ? "…" : `${best}%`} icon={<Trophy size={22} />} />
      </div>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Recent interviews</h2>
            <p>History saved to your account</p>
          </div>
          <button className="text-btn" onClick={() => navigate("/history")}>
            View history <ArrowRight size={16} />
          </button>
        </div>

        {loading ? <p className="muted">Loading your interviews...</p> : recent.length ? (
          <div className="table-card">
            {recent.map((interview) => (
              <div className="interview-row" key={interview.id}>
                <div>
                  <strong>{interview.role}</strong>
                  <span>{interview.interview_type} · {interview.difficulty}</span>
                </div>
                <span>{new Date(interview.created_at).toLocaleDateString()}</span>
                <div className={`score-badge ${interview.status}`}>
                  {interview.total_score == null ? "In progress" : `${Number(interview.total_score)}%`}
                </div>
                <button className="small-btn" onClick={() => navigate(`/interviews/${interview.id}`)}>
                  Continue
                </button>
              </div>
            ))}
          </div>
        ) : !error ? (
          <div className="content-card empty-state">
            <h2>Ready for your first practice?</h2>
            <p className="muted">Your interview history and scores will appear here.</p>
            <button className="primary-btn" onClick={() => navigate("/practice")}>Start interview</button>
          </div>
        ) : null}
      </section>

      <section className="cta-card">
        <div>
          <h2>Practice with personalized questions</h2>
          <p>Choose your role and difficulty, then get scored feedback on each answer.</p>
        </div>
        <button className="primary-btn" onClick={() => navigate("/practice")}>Start new interview</button>
      </section>
    </div>
  );
}

export default Dashboard;
