import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function InterviewInstructions() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const savedConfig = localStorage.getItem("interviewConfig");

    console.log("================================");
    console.log("INTERVIEW INSTRUCTIONS");
    console.log("Saved Config:", savedConfig);
    console.log("================================");

    if (!savedConfig) {
      console.error("Interview config missing");
      navigate("/create-interview", { replace: true });
      return;
    }

    try {
      const parsedConfig = JSON.parse(savedConfig);

      console.log("Parsed Config:", parsedConfig);

      setConfig(parsedConfig);
    } catch (error) {
      console.error("Invalid interview config:", error);

      localStorage.removeItem("interviewConfig");

      navigate("/create-interview", { replace: true });
    }
  }, [navigate]);

  const startInterview = () => {
    const savedConfig = localStorage.getItem("interviewConfig");

    console.log("================================");
    console.log("START INTERVIEW");
    console.log("Config before navigation:", savedConfig);
    console.log("================================");

    if (!savedConfig) {
      alert("Interview configuration is missing.");
      navigate("/create-interview");
      return;
    }

    // Validate config before starting
    try {
      const parsedConfig = JSON.parse(savedConfig);

      if (
        !parsedConfig.role ||
        !parsedConfig.questions ||
        !parsedConfig.duration
      ) {
        throw new Error("Invalid interview configuration");
      }

      // Store clean config again
      localStorage.setItem(
        "interviewConfig",
        JSON.stringify(parsedConfig)
      );

      // Clear previous answers
      localStorage.removeItem("interviewAnswers");

      console.log("Starting Live Interview...");
      console.log("Final Config:", parsedConfig);

      navigate("/live-interview");
    } catch (error) {
      console.error("Start interview error:", error);

      localStorage.removeItem("interviewConfig");

      alert("Interview configuration is invalid.");
      navigate("/create-interview");
    }
  };

  if (!config) {
    return (
      <div
        style={{
          padding: "50px",
          textAlign: "center",
        }}
      >
        Loading interview...
      </div>
    );
  }

  return (
    <div className="instructions-page">
      <div className="instructions-card">
        <div className="instructions-icon">
          🧠
        </div>

        <h1>Your Interview is Ready 🎯</h1>

        <p>
          Make sure you're in a quiet place and your
          microphone is working.
        </p>

        <div className="interview-summary">
          <p>
            <strong>Role:</strong> {config.role}
          </p>

          <p>
            <strong>Interview Type:</strong>{" "}
            {config.type}
          </p>

          <p>
            <strong>Difficulty:</strong>{" "}
            {config.difficulty}
          </p>

          <p>
            <strong>Questions:</strong>{" "}
            {config.questions}
          </p>

          <p>
            <strong>Duration:</strong>{" "}
            {config.duration} Minutes
          </p>
        </div>

        <div className="instruction-list">
          <div className="instruction-item">
            <span>🎤</span>

            <div>
              <strong>Check your microphone</strong>

              <p>
                Make sure your microphone is connected
                and working properly.
              </p>
            </div>
          </div>

          <div className="instruction-item">
            <span>💬</span>

            <div>
              <strong>Answer honestly</strong>

              <p>
                Your answers will be evaluated by AI
                based on relevance and technical
                correctness.
              </p>
            </div>
          </div>

          <div className="instruction-item">
            <span>⏱️</span>

            <div>
              <strong>Manage your time</strong>

              <p>
                The interview will automatically track
                the duration you selected.
              </p>
            </div>
          </div>

          <div className="instruction-item">
            <span>✅</span>

            <div>
              <strong>Answer every question</strong>

              <p>
                You can skip a question if you don't
                know the answer.
              </p>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={() =>
              navigate("/create-interview")
            }
          >
            Back
          </button>

          <button
            type="button"
            className="primary-btn"
            onClick={startInterview}
          >
            Start Interview
          </button>
        </div>
      </div>
    </div>
  );
}

export default InterviewInstructions;