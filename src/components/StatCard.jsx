function StatCard({ title, value, subtitle, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className="stat-title">{title}</span>
        <div className="stat-icon">{icon}</div>
      </div>

      <h2>{value}</h2>

      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}

export default StatCard;