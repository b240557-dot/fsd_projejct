import { useState } from "react";

function Settings() {
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Manage your application preferences.</p>
        </div>
      </div>

      <div className="settings-card">
        <div className="setting-row">
          <div>
            <strong>Email Notifications</strong>
            <p>Receive interview reminders and reports.</p>
          </div>

          <input
            type="checkbox"
            checked={notifications}
            onChange={(e) =>
              setNotifications(e.target.checked)
            }
          />
        </div>

        <div className="setting-row">
          <div>
            <strong>Dark Mode</strong>
            <p>Use dark theme across the application.</p>
          </div>

          <input
            type="checkbox"
            checked={darkMode}
            onChange={(e) =>
              setDarkMode(e.target.checked)
            }
          />
        </div>

        <div className="setting-row danger">
          <div>
            <strong>Delete Account</strong>
            <p>This action cannot be undone.</p>
          </div>

          <button className="danger-btn">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default Settings;