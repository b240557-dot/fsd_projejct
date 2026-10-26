import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle,
  ArrowRight,
  RotateCcw,
} from "lucide-react";

function InterviewResult() {
  const navigate = useNavigate();

  const [interview, setInterview] =
    useState(null);

  const [questions, setQuestions] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    loadResult();
  }, []);

  const loadResult = async () => {
    try {
      const token =
        localStorage.getItem("token") ||
        localStorage.getItem(
          "accessToken"
        ) ||
        localStorage.getItem(
          "authToken"
        );

      const interviewId =
        localStorage.getItem(
          "currentInterviewId"
        );

      if (!token || !interviewId) {
        navigate("/create-interview");
        return;
      }

      const response =
        await fetch(
          `http://localhost:5000/api/interviews/${interviewId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Failed to load result"
        );
      }

      setInterview(
        data.interview
      );

      setQuestions(
        data.questions || []
      );
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        Loading result...
      </div>
    );
  }

  if (!interview) {
    return (
      <div>
        Result not found.
      </div>
    );
  }

  const overallScore =
    Number(interview.score) || 0;

  const answeredQuestions =
    questions.filter(
      (q) => q.answer
    );

  const technicalScore =
    overallScore;

  const communicationScore =
    overallScore;

  const confidenceScore =
    overallScore;

  const getGrade = (score) => {
    if (score >= 80)
      return "Excellent";

    if (score >= 60)
      return "Good";

    if (score >= 40)
      return "Average";

    return "Needs Improvement";
  };

  return (
    <div>
      <div className="result-hero">
        <div className="success-icon">
          <CheckCircle size={50} />
        </div>

        <h1>
          Interview Completed 🎉
        </h1>

        <p>
          Great job! Here's your
          performance report.
        </p>
      </div>

      <div className="overall-score">
        <span>
          Overall Score
        </span>

        <strong>
          {overallScore}%
        </strong>

        <small>
          {getGrade(
            overallScore
          )}
        </small>
      </div>

      <div className="score-grid">
        <div className="score-card">
          <span>
            Technical Knowledge
          </span>

          <strong>
            {technicalScore}%
          </strong>

          <div className="score-bar">
            <div
              style={{
                width: `${technicalScore}%`,
              }}
            />
          </div>
        </div>

        <div className="score-card">
          <span>
            Communication
          </span>

          <strong>
            {communicationScore}%
          </strong>

          <div className="score-bar">
            <div
              style={{
                width: `${communicationScore}%`,
              }}
            />
          </div>
        </div>

        <div className="score-card">
          <span>
            Confidence
          </span>

          <strong>
            {confidenceScore}%
          </strong>

          <div className="score-bar">
            <div
              style={{
                width: `${confidenceScore}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="feedback-grid">
        <div className="feedback-card">
          <h2>
            💪 Strengths
          </h2>

          <ul>
            <li>
              AI evaluated your
              interview answers
            </li>

            <li>
              Each question received
              an individual score
            </li>

            <li>
              Your final score is based
              on your actual answers
            </li>
          </ul>
        </div>

        <div className="feedback-card">
          <h2>
            📈 Areas to Improve
          </h2>

          <ul>
            <li>
              Keep answers relevant
              to the question
            </li>

            <li>
              Explain technical
              reasoning
            </li>

            <li>
              Add practical examples
            </li>
          </ul>
        </div>
      </div>

      <div className="result-actions">
        <button
          className="secondary-btn"
          onClick={() =>
            navigate(
              "/create-interview"
            )
          }
        >
          <RotateCcw size={18} />
          Try Again
        </button>

        <button
          className="primary-btn"
          onClick={() =>
            navigate(
              "/result/questions"
            )
          }
        >
          Question Analysis
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

export default InterviewResult;