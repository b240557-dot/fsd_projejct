import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Mic,
  Send,
  SkipForward,
  Clock,
  Bot,
} from "lucide-react";

const allQuestions = [
  "Tell me about yourself and your technical background.",
  "Explain the difference between REST API and SOAP API.",
  "What is the virtual DOM in React?",
  "Explain the concept of JWT authentication.",
  "How would you optimize a slow web application?",
  "What is the difference between SQL and NoSQL databases?",
  "Explain the concept of middleware in Express.js.",
  "What is authentication vs authorization?",
  "Explain React state and props.",
  "How does Git work.",
  "What is the difference between authentication and authorization?",
  "Explain how Node.js handles asynchronous operations.",
  "What are React hooks?",
  "What is database indexing?",
  "Explain the MVC architecture.",
  "What is CORS and why is it needed?",
  "Explain promises and async/await in JavaScript.",
  "What is the difference between PUT and PATCH?",
  "How does JWT authentication work?",
  "What are the advantages of using TypeScript?",
];

function LiveInterview() {
  const navigate = useNavigate();

  const [config, setConfig] = useState(null);
  const [questions, setQuestions] = useState([]);

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answer, setAnswer] = useState("");
  const [isListening, setIsListening] = useState(false);

  const [time, setTime] = useState(0);

  // ==========================================
  // LOAD CONFIGURATION
  // ==========================================

  useEffect(() => {
    console.log("================================");
    console.log("LIVE INTERVIEW LOADING");
    console.log("================================");

    const savedConfig =
      localStorage.getItem("interviewConfig");

    console.log(
      "LiveInterview savedConfig:",
      savedConfig
    );

    if (!savedConfig) {
      console.error(
        "NO INTERVIEW CONFIG FOUND"
      );

      navigate("/create-interview", {
        replace: true,
      });

      return;
    }

    try {
      const parsedConfig =
        JSON.parse(savedConfig);

      console.log(
        "LiveInterview parsedConfig:",
        parsedConfig
      );

      const questionCount =
        Number(parsedConfig.questions) || 5;

      const duration =
        Number(parsedConfig.duration) || 15;

      const selectedQuestions =
        allQuestions.slice(
          0,
          Math.min(
            questionCount,
            allQuestions.length
          )
        );

      console.log(
        "Selected Questions:",
        selectedQuestions
      );

      console.log(
        "Question Count:",
        selectedQuestions.length
      );

      console.log(
        "Duration:",
        duration
      );

      setConfig(parsedConfig);

      setQuestions(selectedQuestions);

      setTime(duration * 60);

    } catch (error) {
      console.error(
        "Failed to parse interview config:",
        error
      );

      localStorage.removeItem(
        "interviewConfig"
      );

      navigate("/create-interview", {
        replace: true,
      });
    }
  }, [navigate]);

  // ==========================================
  // TIMER
  // ==========================================

  useEffect(() => {
    if (!config) {
      return;
    }

    const timer = setInterval(() => {
      setTime((prev) => {
        if (prev <= 1) {
          clearInterval(timer);

          console.log(
            "Interview time finished."
          );

          navigate("/result");

          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [config, navigate]);

  // ==========================================
  // FORMAT TIMER
  // ==========================================

  const formatTime = () => {
    const minutes = Math.floor(time / 60);

    const seconds = time % 60;

    return `${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  };

  // ==========================================
  // SAVE ANSWER
  // ==========================================

  const saveAnswer = (answerText, skipped = false) => {
    const savedAnswers =
      JSON.parse(
        localStorage.getItem(
          "interviewAnswers"
        ) || "[]"
      );

    savedAnswers.push({
      question:
        questions[currentQuestion],

      answer: answerText,

      skipped,
    });

    localStorage.setItem(
      "interviewAnswers",
      JSON.stringify(savedAnswers)
    );

    console.log(
      "Saved answer:",
      savedAnswers
    );
  };

  // ==========================================
  // SUBMIT ANSWER
  // ==========================================

  const submitAnswer = () => {
    if (!answer.trim()) {
      alert("Please enter your answer.");
      return;
    }

    saveAnswer(answer, false);

    if (
      currentQuestion ===
      questions.length - 1
    ) {
      console.log(
        "Last question completed."
      );

      navigate("/result");

      return;
    }

    setAnswer("");

    setCurrentQuestion(
      (prev) => prev + 1
    );
  };

  // ==========================================
  // SKIP QUESTION
  // ==========================================

  const skipQuestion = () => {
    saveAnswer("", true);

    if (
      currentQuestion ===
      questions.length - 1
    ) {
      navigate("/result");

      return;
    }

    setAnswer("");

    setCurrentQuestion(
      (prev) => prev + 1
    );
  };

  // ==========================================
  // LOADING
  // ==========================================

  if (
    !config ||
    questions.length === 0
  ) {
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

  // ==========================================
  // UI
  // ==========================================

  return (
    <div className="interview-page">

      {/* TOP BAR */}

      <div className="interview-topbar">

        <div className="brand-small">
          <Bot size={22} />

          AI Interviewer
        </div>

        <div className="question-count">
          Question{" "}
          {currentQuestion + 1} /{" "}
          {questions.length}
        </div>

        <div className="timer">
          <Clock size={18} />

          {formatTime()}
        </div>

      </div>

      {/* PROGRESS */}

      <div className="progress-line">

        <div
          style={{
            width: `${
              ((currentQuestion + 1) /
                questions.length) *
              100
            }%`,
          }}
        />

      </div>

      {/* CONTENT */}

      <div className="interview-content">

        <div className="ai-avatar">
          <Bot size={60} />
        </div>

        <p className="ai-label">
          AI Interviewer
        </p>

        {/* QUESTION */}

        <div className="question-box">

          <h1>
            {questions[currentQuestion]}
          </h1>

        </div>

        {/* ANSWER */}

        <div className="answer-section">

          <label>Your Answer</label>

          <textarea
            value={answer}
            onChange={(e) =>
              setAnswer(e.target.value)
            }
            placeholder="Type your answer here..."
            rows="7"
          />

          <div className="answer-actions">

            <button
              className={`mic-btn ${
                isListening
                  ? "listening"
                  : ""
              }`}
              onClick={() =>
                setIsListening(
                  !isListening
                )
              }
            >
              <Mic size={20} />

              {isListening
                ? "Listening..."
                : "Start Speaking"}
            </button>

            <div>

              <button
                className="secondary-btn"
                onClick={skipQuestion}
              >
                <SkipForward size={18} />

                Skip
              </button>

              <button
                className="primary-btn"
                onClick={submitAnswer}
              >
                <Send size={18} />

                Submit Answer
              </button>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

export default LiveInterview;