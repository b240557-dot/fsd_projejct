import { useState } from "react";

function Profile() {
  const [profile, setProfile] = useState({
    name: "Your Name",
    email: "your@email.com",
    role: "Full Stack Developer",
    experience: "Fresher",
  });

  const handleChange = (e) => {
    setProfile({
      ...profile,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Profile</h1>
          <p>Manage your personal information.</p>
        </div>
      </div>

      <div className="profile-card">
        <div className="profile-avatar">
          {profile.name.charAt(0)}
        </div>

        <div className="form-grid">
          <div className="input-group">
            <label>Name</label>
            <input
              name="name"
              value={profile.name}
              onChange={handleChange}
            />
          </div>

          <div className="input-group">
            <label>Email</label>
            <input
              name="email"
              value={profile.email}
              onChange={handleChange}
            />
          </div>

          <div className="input-group">
            <label>Target Role</label>
            <input
              name="role"
              value={profile.role}
              onChange={handleChange}
            />
          </div>

          <div className="input-group">
            <label>Experience</label>
            <select
              name="experience"
              value={profile.experience}
              onChange={handleChange}
            >
              <option>Fresher</option>
              <option>0-1 Years</option>
              <option>1-3 Years</option>
              <option>3+ Years</option>
            </select>
          </div>
        </div>

        <button className="primary-btn">
          Save Changes
        </button>
      </div>
    </div>
  );
}

export default Profile;