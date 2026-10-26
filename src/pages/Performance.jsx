import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { name: "Interview 1", score: 62 },
  { name: "Interview 2", score: 68 },
  { name: "Interview 3", score: 71 },
  { name: "Interview 4", score: 76 },
  { name: "Interview 5", score: 82 },
];

function Performance() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Performance</h1>
          <p>Track your interview improvement over time.</p>
        </div>
      </div>

      <div className="chart-card">
        <h2>Score Progress</h2>

        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis dataKey="name" />

              <YAxis domain={[0, 100]} />

              <Tooltip />

              <Line
                type="monotone"
                dataKey="score"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="performance-grid">
        <div className="performance-card">
          <span>Technical</span>
          <strong>86%</strong>
        </div>

        <div className="performance-card">
          <span>Communication</span>
          <strong>82%</strong>
        </div>

        <div className="performance-card">
          <span>Confidence</span>
          <strong>74%</strong>
        </div>

        <div className="performance-card">
          <span>Problem Solving</span>
          <strong>88%</strong>
        </div>
      </div>
    </div>
  );
}

export default Performance;