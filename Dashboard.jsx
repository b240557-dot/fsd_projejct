import { useNavigate } from "react-router-dom";
import {
  Brain,
  Target,
  Trophy,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

import StatCard from "../components/StatCard";

const recentInterviews = [
  {
    role: "Full Stack Developer",
    type: "Technical",
    score: 82,
    date: "Aug 7, 2026",
  },
  {
    role: "Java Developer",
    type: "Technical",
    score: 76,
    date: "Aug 5, 2026",
  },
  {
    role: "HR Interview",
    type: "Behavioral",
    score: 88,
    date: "Aug 2, 2026",
  },
];

function Dashboard() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Good Morning 👋</h1>
          <p>Ready for your next interview?</p>
        </div>

        <button
          className="primary-btn"
          onClick={() => navigate("/create-interview")}
        >
          <Brain size={20} />
          Start Interview
        </button>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Total Interviews"
          value="12"
          subtitle="+3 this month"
          icon={<Brain size={22} />}
        />

        <StatCard
          title="Average Score"
          value="78%"
          subtitle="+8% from last month"
          icon={<Target size={22} />}
        />

        <StatCard
          title="Best Score"
          value="91%"
          subtitle="Personal best"
          icon={<Trophy size={22} />}
        />

        <StatCard
          title="Improvement"
          value="+12%"
          subtitle="Since first interview"
          icon={<TrendingUp size={22} />}
        />
      </div>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Recent Interviews</h2>
            <p>Your latest interview attempts</p>
          </div>

          <button
            className="text-btn"
            onClick={() => navigate("/history")}
          >
            View All <ArrowRight size={16} />
          </button>
        </div>

        <div className="table-card">
          {recentInterviews.map((interview, index) => (
            <div className="interview-row" key={index}>
              <div>
                <strong>{interview.role}</strong>
                <span>{interview.type}</span>
              </div>

              <span>{interview.date}</span>

              <div className="score-badge">
                {interview.score}%
              </div>

              <button
                className="small-btn"
                onClick={() => navigate("/result")}
              >
                View
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-card">
        <div>
          <h2>Ready to improve your interview skills?</h2>
          <p>
            Practice with AI-generated questions and get instant feedback.
          </p>
        </div>

        <button
          className="primary-btn"
          onClick={() => navigate("/create-interview")}
        >
          Start New Interview
        </button>
      </section>
    </div>
  );
}

export default Dashboard;