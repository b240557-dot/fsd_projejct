import { useState } from "react";
import { useNavigate } from "react-router-dom";

function CreateInterview() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    type: "Technical Interview",
    role: "Full Stack Developer",
    difficulty: "Medium",
    questions: "5",
    duration: "15",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    try {
      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("accessToken") ||
        localStorage.getItem("authToken");

      if (!token) {
        alert("Please login first.");
        navigate("/login");
        return;
      }

      const interviewConfig = {
        type: form.type,
        role: form.role,
        difficulty: form.difficulty,
        questions: Number(form.questions),
        duration: Number(form.duration),
      };

      localStorage.setItem(
        "interviewConfig",
        JSON.stringify(interviewConfig)
      );

      localStorage.removeItem("interviewAnswers");
      localStorage.removeItem("interviewResult");
      localStorage.removeItem("currentInterviewId");

      const response = await fetch(
        "http://localhost:5000/api/interviews",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            role: form.role,
            interviewType: form.type,
            difficulty: form.difficulty,
            questionCount: Number(form.questions),
            duration: Number(form.duration),
          }),
        }
      );

      const data = await response.json();

      console.log("Create interview response:", data);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to create interview"
        );
      }

      localStorage.setItem(
        "currentInterviewId",
        String(data.interview.id)
      );

      navigate("/interview-instructions");
    } catch (error) {
      console.error("Create interview error:", error);

      alert(
        error.message ||
          "Unable to create interview. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Create Interview</h1>
          <p>Customize your AI mock interview.</p>
        </div>
      </div>

      <form
        className="form-card"
        onSubmit={handleSubmit}
      >
        <div className="form-section">
          <h2>Interview Type</h2>

          <div className="option-grid">
            {[
              "Technical Interview",
              "HR Interview",
              "Behavioral Interview",
              "Coding Interview",
              "Mixed Interview",
            ].map((type) => (
              <label
                key={type}
                className={`option-card ${
                  form.type === type ? "selected" : ""
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={type}
                  checked={form.type === type}
                  onChange={handleChange}
                />

                <span>{type}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-grid">
          <div className="input-group">
            <label>Job Role</label>

            <select
              name="role"
              value={form.role}
              onChange={handleChange}
            >
              <option value="Full Stack Developer">
                Full Stack Developer
              </option>

              <option value="Frontend Developer">
                Frontend Developer
              </option>

              <option value="Backend Developer">
                Backend Developer
              </option>

              <option value="Java Developer">
                Java Developer
              </option>

              <option value="Python Developer">
                Python Developer
              </option>

              <option value="ML Engineer">
                ML Engineer
              </option>

              <option value="Data Scientist">
                Data Scientist
              </option>
            </select>
          </div>

          <div className="input-group">
            <label>Difficulty</label>

            <select
              name="difficulty"
              value={form.difficulty}
              onChange={handleChange}
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          <div className="input-group">
            <label>Number of Questions</label>

            <select
              name="questions"
              value={form.questions}
              onChange={handleChange}
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="20">20</option>
            </select>
          </div>

          <div className="input-group">
            <label>Duration</label>

            <select
              name="duration"
              value={form.duration}
              onChange={handleChange}
            >
              <option value="15">15 Minutes</option>
              <option value="30">30 Minutes</option>
              <option value="45">45 Minutes</option>
              <option value="60">60 Minutes</option>
            </select>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={() => navigate("/dashboard")}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="primary-btn"
            disabled={loading}
          >
            {loading
              ? "Creating Interview..."
              : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateInterview;