import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "./api";
import MarkdownContent from "./MarkdownContent";

function InterviewSession() {
  const { interviewId } = useParams();
  const [details, setDetails] = useState(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [lastEvaluation, setLastEvaluation] = useState(null);
  const [showPreviousAnswer, setShowPreviousAnswer] = useState(false);
  const [showAnswerHistory, setShowAnswerHistory] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState("");
  const [chatSubmitting, setChatSubmitting] = useState(false);

  const loadInterview = useCallback(async () => {
    try {
      const result = await api.getInterview(interviewId);
      setDetails(result);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  useEffect(() => {
    let active = true;
    api.getInterview(interviewId)
      .then((result) => {
        if (active) setDetails(result);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [interviewId]);

  async function submitAnswer(event) {
    event.preventDefault();
    const question = details?.questions.find((item) => item.answer_text === null);
    if (!question) return;

    setSubmitting(true);
    setError("");
    setLastEvaluation(null);
    setShowPreviousAnswer(false);
    setShowAnswerHistory(false);
    try {
      const result = await api.submitAnswer(interviewId, {
        question_id: question.id,
        answer,
      });
      setLastEvaluation(result.evaluation);
      setAnswer("");
      await loadInterview();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitChatMessage(event) {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message) return;

    const messages = [...chatMessages, { role: "user", content: message }];
    setChatMessages(messages);
    setChatInput("");
    setChatError("");
    setChatSubmitting(true);
    try {
      const result = await api.chat({ interview_id: Number(interviewId), messages });
      setChatMessages([...messages, { role: "assistant", content: result.reply }]);
    } catch (requestError) {
      setChatError(requestError.message);
    } finally {
      setChatSubmitting(false);
    }
  }

  if (loading) return <p className="muted">Loading interview...</p>;
  if (error && !details) return <section className="content-card status-page"><p className="form-message error">{error}</p><Link className="primary-btn" to="/history">View interview history</Link></section>;
  if (!details) return null;

  const { interview, questions, report } = details;
  const nextQuestion = questions.find((item) => item.answer_text === null);
  const completedCount = questions.filter((item) => item.answer_text !== null).length;
  const previousQuestion = completedCount > 0 ? questions[completedCount - 1] : null;

  return (
    <section className="content-card session-card">
      <span className="eyebrow">{interview.interview_type} · {interview.difficulty}</span>
      <h1>{interview.role}</h1>
      <p className="muted">Question {Math.min(completedCount + 1, questions.length)} of {questions.length}</p>
      {error && <p className="form-message error" role="alert">{error}</p>}

      {completedCount > 0 && (
        <div className="answer-history-toggle">
          <button
            className="text-btn"
            type="button"
            aria-expanded={showAnswerHistory}
            onClick={() => setShowAnswerHistory((visible) => !visible)}
          >
            {showAnswerHistory ? "Hide answer history" : `Show answer history (${completedCount})`}
          </button>
          {showAnswerHistory && (
            <section className="answer-review">
              <h2>Your answers and performance</h2>
              {questions.filter((item) => item.answer_text !== null).map((item, index) => (
                <article className="answer-review-card" key={item.id}>
                  <div className="answer-review-heading">
                    <strong>Question {index + 1}</strong>
                    <span className="score-badge">{Number(item.score)}%</span>
                  </div>
                  <MarkdownContent className="answer-review-question">{item.question_text}</MarkdownContent>
                  <MarkdownContent className="answer-review-answer">{item.answer_text}</MarkdownContent>
                  <MarkdownContent className="answer-review-feedback">{item.feedback}</MarkdownContent>
                  {item.missing_concepts?.length > 0 && (
                    <div className="answer-review-detail">
                      <strong>Missing concepts</strong>
                      <ul>{item.missing_concepts.map((concept, index) => (
                        <li key={`${item.id}-missing-${index}`}><MarkdownContent>{concept}</MarkdownContent></li>
                      ))}</ul>
                    </div>
                  )}
                  {item.improved_answer && (
                    <div className="answer-review-detail">
                      <strong>Improved answer example</strong>
                      <MarkdownContent>{item.improved_answer}</MarkdownContent>
                    </div>
                  )}
                </article>
              ))}
            </section>
          )}
        </div>
      )}

      {report ? (
        <div className="report-panel">
          <div className="report-score">{Number(report.overall_score)}<span>/100</span></div>
          <h2>Interview complete</h2>
          <MarkdownContent>{report.summary ?? report.overall_feedback}</MarkdownContent>
          {report.strengths?.length > 0 && (
            <div className="report-detail">
              <strong>Strengths</strong>
              <ul>{report.strengths.map((item, index) => (
                <li key={`strength-${index}`}><MarkdownContent>{item}</MarkdownContent></li>
              ))}</ul>
            </div>
          )}
          {report.areas_to_improve?.length > 0 && (
            <div className="report-detail">
              <strong>Areas to improve</strong>
              <ul>{report.areas_to_improve.map((item, index) => (
                <li key={`improve-${index}`}><MarkdownContent>{item}</MarkdownContent></li>
              ))}</ul>
            </div>
          )}
          {report.recommendations?.length > 0 && (
            <div className="report-detail">
              <strong>Recommendations</strong>
              <ul>{report.recommendations.map((item, index) => (
                <li key={`recommendation-${index}`}><MarkdownContent>{item}</MarkdownContent></li>
              ))}</ul>
            </div>
          )}
          <Link className="primary-btn" to="/history">View history</Link>
        </div>
      ) : nextQuestion ? (
        <>
          <article className="question-panel">
            <span>YOUR QUESTION</span>
            <MarkdownContent>{nextQuestion.question_text}</MarkdownContent>
          </article>
          {previousQuestion && (
            <div className="previous-answer-toggle">
              <button
                className="text-btn"
                type="button"
                aria-expanded={showPreviousAnswer}
                onClick={() => setShowPreviousAnswer((visible) => !visible)}
              >
                {showPreviousAnswer ? "Hide previous answer" : "Show previous answer and feedback"}
              </button>
              {showPreviousAnswer && (
                <aside className="evaluation-panel" role="status">
                  <strong>Previous answer score: {Number(lastEvaluation?.score ?? previousQuestion.score)}/100</strong>
                  <div className="evaluation-detail">
                    <strong>Your previous answer</strong>
                    <MarkdownContent>{previousQuestion.answer_text}</MarkdownContent>
                  </div>
                  <div className="evaluation-detail">
                    <strong>Feedback</strong>
                    <MarkdownContent>{lastEvaluation?.feedback ?? previousQuestion.feedback}</MarkdownContent>
                  </div>
                  {(lastEvaluation?.missing_concepts ?? previousQuestion.missing_concepts)?.length > 0 && (
                    <div className="evaluation-detail">
                      <strong>Missing concepts</strong>
                      <ul>{(lastEvaluation?.missing_concepts ?? previousQuestion.missing_concepts).map((concept, index) => (
                        <li key={`previous-missing-${index}`}><MarkdownContent>{concept}</MarkdownContent></li>
                      ))}</ul>
                    </div>
                  )}
                  {(lastEvaluation?.improved_answer ?? previousQuestion.improved_answer) && (
                    <div className="evaluation-detail">
                      <strong>Improved answer example</strong>
                      <MarkdownContent>{lastEvaluation?.improved_answer ?? previousQuestion.improved_answer}</MarkdownContent>
                    </div>
                  )}
                </aside>
              )}
            </div>
          )}
          <form className="practice-form" onSubmit={submitAnswer}>
            <label>Your answer
              <textarea
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                rows="7"
                maxLength="12000"
                placeholder="Write your answer here..."
                required
              />
            </label>
            <button className="primary-btn" type="submit" disabled={submitting || !answer.trim()}>
              {submitting ? "Evaluating answer..." : "Submit answer"}
            </button>
          </form>
        </>
      ) : (
        <div className="report-panel">
          <p>Your answers were saved. Refresh the interview to load its report.</p>
          <button className="primary-btn" onClick={loadInterview}>Refresh</button>
        </div>
      )}

      <section className="interview-chat">
        <h2>Ask the AI interview coach</h2>
        <div className="chat-messages" aria-live="polite">
          {chatMessages.map((message, index) => (
            <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
              <strong>{message.role === "user" ? "You" : "Coach"}</strong>
              <MarkdownContent>{message.content}</MarkdownContent>
            </div>
          ))}
        </div>
        {chatError && <p className="form-message error" role="alert">{chatError}</p>}
        <form className="chat-form" onSubmit={submitChatMessage}>
          <label className="sr-only" htmlFor="interview-coach-message">Message the interview coach</label>
          <textarea
            id="interview-coach-message"
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            rows="2"
            maxLength="4000"
            placeholder="Ask for advice about this interview..."
            required
          />
          <button className="primary-btn" type="submit" disabled={chatSubmitting || !chatInput.trim()}>
            {chatSubmitting ? "Sending..." : "Ask coach"}
          </button>
        </form>
      </section>
    </section>
  );
}

export default InterviewSession;
