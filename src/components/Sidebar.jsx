import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  PlusCircle,
  BarChart3,
  History,
  User,
  Settings,
  LogOut,
} from "lucide-react";

const menuItems = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "New Interview",
    path: "/create-interview",
    icon: PlusCircle,
  },
  {
    name: "Performance",
    path: "/performance",
    icon: BarChart3,
  },
  {
    name: "History",
    path: "/history",
    icon: History,
  },
  {
    name: "Profile",
    path: "/profile",
    icon: User,
  },
  {
    name: "Settings",
    path: "/settings",
    icon: Settings,
  },
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-icon">AI</div>
        <span>InterviewAI</span>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      <button
        className="logout-btn"
        onClick={() => {
          console.log("Logout");
        }}
      >
        <LogOut size={20} />
        Logout
      </button>
    </aside>
  );
}

export default Sidebar;