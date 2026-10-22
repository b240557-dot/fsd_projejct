function StatCard({ title, value, subtitle, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon">
        {icon}
      </div>

      <h3>{title}</h3>
      <h2>{value}</h2>
      {subtitle && <p className="stat-card-subtitle">{subtitle}</p>}
    </div>
  );
}

export default StatCard;