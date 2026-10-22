import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "./api";

function InterviewHistory() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getInterviews()
      .then((result) => setInterviews(result.interviews))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="history-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">YOUR PRACTICE</span>
          <h1>Interview history</h1>
          <p>Review your saved interviews and scores.</p>
        </div>
        <Link className="primary-btn" to="/practice">Start interview</Link>
      </div>
      {error && <p className="form-message error" role="alert">{error}</p>}
      {loading ? <p className="muted">Loading your interviews...</p> : interviews.length ? (
        <div className="table-card history-list">
          {interviews.map((item) => (
            <Link className="history-row" to={`/interviews/${item.id}`} key={item.id}>
              <div>
                <strong>{item.role}</strong>
                <span>{item.interview_type} · {item.difficulty}</span>
              </div>
              <span>{new Date(item.created_at).toLocaleDateString()}</span>
              <span className={`status-badge ${item.status}`}>{item.status.replace("_", " ")}</span>
              <strong>{item.total_score == null ? "—" : `${Number(item.total_score)}%`}</strong>
            </Link>
          ))}
        </div>
      ) : !error ? (
        <div className="content-card empty-state">
          <h2>No interviews yet</h2>
          <p className="muted">Create your first AI interview to see it here.</p>
          <Link className="primary-btn" to="/practice">Start practicing</Link>
        </div>
      ) : null}
    </section>
  );
}

export default InterviewHistory;
