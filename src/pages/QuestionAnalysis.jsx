import { useEffect, useState } from "react";

function QuestionAnalysis() {
  const [questions, setQuestions] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    loadInterview();
  }, []);

  const loadInterview = async () => {
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
        throw new Error(
          "Interview session not found."
        );
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
            "Failed to load analysis"
        );
      }

      setQuestions(
        data.questions || []
      );
    } catch (error) {
      console.error(error);

      setError(
        error.message ||
          "Failed to load analysis"
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <h1>Question Analysis</h1>
        <p>
          Loading AI analysis...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1>Question Analysis</h1>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>
            Question Analysis
          </h1>

          <p>
            Detailed AI feedback for
            every question.
          </p>
        </div>
      </div>

      <div className="analysis-list">
        {questions.map(
          (item, index) => (
            <div
              className="analysis-card"
              key={item.id}
            >
              <div className="analysis-header">
                <span>
                  Question {index + 1}
                </span>

                <strong>
                  {item.score}/10
                </strong>
              </div>

              <h2>
                {item.question}
              </h2>

              <div className="your-answer">
                <strong>
                  Your Answer
                </strong>

                <p>
                  {item.answer
                    ? item.answer
                    : "No answer provided."}
                </p>
              </div>

              <div className="ai-feedback">
                <strong>
                  AI Feedback
                </strong>

                <p>
                  {item.feedback ||
                    "No feedback available."}
                </p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default QuestionAnalysis;