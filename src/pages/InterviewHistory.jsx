import { useNavigate } from "react-router-dom";

const interviews = [
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
  {
    role: "ML Engineer",
    type: "Technical",
    score: 79,
    date: "Jul 30, 2026",
  },
];

function InterviewHistory() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Interview History</h1>
          <p>View all your previous interviews.</p>
        </div>
      </div>

      <div className="history-card">
        {interviews.map((item, index) => (
          <div className="history-row" key={index}>
            <div>
              <strong>{item.role}</strong>
              <span>{item.type}</span>
            </div>

            <span>{item.date}</span>

            <strong>{item.score}%</strong>

            <button
              className="small-btn"
              onClick={() => navigate("/result")}
            >
              View Report
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default InterviewHistory;