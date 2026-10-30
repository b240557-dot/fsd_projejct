import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { api } from "./api";
import MarkdownContent from "./MarkdownContent";
import { isSpeechSynthesisAvailable, speakText, stopSpeaking } from "./speech";

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
  const [questionMode, setQuestionMode] = useState("text");
  const [answerMode, setAnswerMode] = useState("text");
  const [speaking, setSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [microphoneStatus, setMicrophoneStatus] = useState("");
  const [answerError, setAnswerError] = useState("");
  const recorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);
  const discardRecordingRef = useRef(false);

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

  const { interview, questions = [], report } = details ?? {};
  const nextQuestion = questions.find((item) => item.answer_text === null);
  const questionId = nextQuestion?.id;
  const questionText = nextQuestion?.question_text;
  const completedCount = questions.filter((item) => item.answer_text !== null).length;
  const previousQuestion = completedCount > 0 ? questions[completedCount - 1] : null;

  useEffect(() => {
    if (!questionId || !questionText || questionMode !== "voice" || lastEvaluation) {
      stopSpeaking();
      return undefined;
    }

    speakText(questionText, setSpeaking);
    return () => stopSpeaking();
  }, [questionId, questionText, questionMode, lastEvaluation]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      discardRecordingRef.current = true;
      stopSpeaking();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    };
  }, []);

  async function startRecording() {
    setAnswerError("");
    setMicrophoneStatus("");
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder !== "function") {
      setAnswerError("Voice recording is not supported in this browser. Switch to Text Answer Mode.");
      return;
    }

    try {
      setMicrophoneStatus("Requesting microphone permission...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      mediaStreamRef.current = stream;
      discardRecordingRef.current = false;
      const supportedTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];
      const mimeType = supportedTypes.find((type) => window.MediaRecorder.isTypeSupported(type));
      const recorder = mimeType
        ? new window.MediaRecorder(stream, { mimeType })
        : new window.MediaRecorder(stream);
      audioChunksRef.current = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) audioChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        recorderRef.current = null;
        if (!mountedRef.current) return;
        setRecording(false);
        setMicrophoneStatus("");
        setAnswerError("Recording failed. Check your microphone and try again.");
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        recorderRef.current = null;
        if (!mountedRef.current || discardRecordingRef.current) return;
        setRecording(false);
        setMicrophoneStatus("");

        const audio = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        audioChunksRef.current = [];
        if (!audio.size) {
          setAnswerError("No audio was captured. Check your microphone and record again.");
          return;
        }

        const extension = audio.type.includes("ogg") ? "ogg" : audio.type.includes("mp4") ? "mp4" : "webm";
        const formData = new FormData();
        formData.append("file", audio, `answer.${extension}`);
        setTranscribing(true);
        setMicrophoneStatus("Transcribing your answer...");
        setAnswerError("");
        try {
          const result = await api.transcribeAudio(formData);
          setAnswer(result.transcript);
          setMicrophoneStatus("Transcript ready. Review or edit it before submitting.");
        } catch (requestError) {
          setAnswerError(requestError.message);
          setMicrophoneStatus("");
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      setRecording(true);
      setMicrophoneStatus("Recording. Select Stop recording when you are finished.");
    } catch (recordingError) {
      if (!mountedRef.current) return;
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setRecording(false);
      setMicrophoneStatus("");
      if (recordingError.name === "NotAllowedError" || recordingError.name === "SecurityError") {
        setAnswerError("Microphone permission was denied. Allow microphone access or switch to Text Answer Mode.");
      } else if (recordingError.name === "NotFoundError") {
        setAnswerError("No microphone was found. Connect a microphone or switch to Text Answer Mode.");
      } else {
        setAnswerError("Could not start recording. Check microphone access and try again.");
      }
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function submitAnswer(event) {
    event.preventDefault();
    if (submittingRef.current || !nextQuestion || !answer.trim() || recording || transcribing) return;

    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    setLastEvaluation(null);
    setShowPreviousAnswer(true);
    setShowAnswerHistory(false);
    try {
      const result = await api.submitAnswer(interviewId, {
        question_id: nextQuestion.id,
        answer: answer.trim(),
      });
      setLastEvaluation(result.evaluation);
      setAnswer("");
      await loadInterview();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
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

  return (
    <section className="content-card session-card">
      <span className="eyebrow">{interview.interview_type} · {interview.difficulty}</span>
      <h1>{interview.role}</h1>
      <p className="muted">
        {lastEvaluation && nextQuestion
          ? `Question ${completedCount} evaluated · Next: ${completedCount + 1} of ${questions.length}`
          : `Question ${Math.min(completedCount + 1, questions.length)} of ${questions.length}`}
      </p>
      <progress className="interview-progress" value={completedCount} max={Math.max(questions.length, 1)} aria-label="Interview progress" />
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
          {lastEvaluation ? (
            <section className="evaluation-panel" aria-live="polite">
              <strong>Answer score: {Number(lastEvaluation.score)}/100</strong>
              <div className="evaluation-detail">
                <strong>Feedback</strong>
                <MarkdownContent>{lastEvaluation.feedback}</MarkdownContent>
              </div>
              {lastEvaluation.missing_concepts?.length > 0 && (
                <div className="evaluation-detail">
                  <strong>Missing concepts</strong>
                  <ul>{lastEvaluation.missing_concepts.map((concept, index) => (
                    <li key={`current-missing-${index}`}><MarkdownContent>{concept}</MarkdownContent></li>
                  ))}</ul>
                </div>
              )}
              {lastEvaluation.improved_answer && (
                <div className="evaluation-detail">
                  <strong>Suggested improved answer</strong>
                  <MarkdownContent>{lastEvaluation.improved_answer}</MarkdownContent>
                </div>
              )}
              <button className="primary-btn" type="button" onClick={() => setLastEvaluation(null)}>
                Next question
              </button>
            </section>
          ) : (
            <>
          <div className="interview-modes">
            <fieldset>
              <legend>Question delivery</legend>
              <label>
                <input
                  type="radio"
                  name="question-mode"
                  value="voice"
                  checked={questionMode === "voice"}
                  onChange={() => setQuestionMode("voice")}
                />
                Voice question
              </label>
              <label>
                <input
                  type="radio"
                  name="question-mode"
                  value="text"
                  checked={questionMode === "text"}
                  onChange={() => setQuestionMode("text")}
                />
                Text question
              </label>
            </fieldset>
            <fieldset>
              <legend>Your answer</legend>
              <label>
                <input
                  type="radio"
                  name="answer-mode"
                  value="voice"
                  checked={answerMode === "voice"}
                  disabled={recording || transcribing || submitting}
                  onChange={() => {
                    setAnswerMode("voice");
                    setAnswer("");
                    setAnswerError("");
                  }}
                />
                Voice answer
              </label>
              <label>
                <input
                  type="radio"
                  name="answer-mode"
                  value="text"
                  checked={answerMode === "text"}
                  disabled={recording || transcribing || submitting}
                  onChange={() => {
                    stopRecording();
                    setAnswerMode("text");
                    setAnswerError("");
                  }}
                />
                Text answer
              </label>
            </fieldset>
          </div>
          <article className="question-panel">
            <span>YOUR QUESTION</span>
            <MarkdownContent>{nextQuestion.question_text}</MarkdownContent>
            <div className="speech-controls">
              {questionMode === "voice" && (
                <span className={speaking ? "playback-status is-speaking" : "playback-status"} role="status">
                  {isSpeechSynthesisAvailable() ? (
                    <>
                      <Volume2 size={16} aria-hidden="true" />
                      {speaking ? "AI interviewer is speaking" : "Voice question"}
                    </>
                  ) : "Speech playback is unavailable in this browser."}
                </span>
              )}
              {isSpeechSynthesisAvailable() && (
                <button
                  className="secondary-btn"
                  type="button"
                  onClick={() => speakText(questionText, setSpeaking)}
                >
                  <Volume2 size={16} />
                  {questionMode === "voice" ? "Replay question" : "Read question aloud"}
                </button>
              )}
              {speaking && isSpeechSynthesisAvailable() && (
                <button className="secondary-btn" type="button" onClick={() => {
                  stopSpeaking();
                  setSpeaking(false);
                }}>
                  <VolumeX size={16} /> Stop speaking
                </button>
              )}
            </div>
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
            {answerMode === "voice" ? (
              <div className="voice-answer-panel">
                <div className="voice-answer-controls">
                  <button
                    className={recording ? "secondary-btn recording-button" : "primary-btn"}
                    type="button"
                    onClick={recording ? stopRecording : startRecording}
                    disabled={transcribing || submitting}
                  >
                    {recording ? <MicOff size={17} /> : <Mic size={17} />}
                    {recording ? "Stop recording" : answer ? "Record again" : "Start recording"}
                  </button>
                  {answer && !recording && !transcribing && (
                    <button className="text-btn" type="button" onClick={() => setAnswer("")}>
                      Clear transcript
                    </button>
                  )}
                </div>
                {microphoneStatus && <p className="muted" role="status">{microphoneStatus}</p>}
                {transcribing && <p className="muted" role="status">Transcribing recording...</p>}
                {(answer || transcribing) && (
                  <label htmlFor="voice-transcript">Review and edit your transcript
                    <textarea
                      id="voice-transcript"
                      value={answer}
                      onChange={(event) => setAnswer(event.target.value)}
                      rows="6"
                      maxLength="12000"
                      placeholder="Your transcript will appear here."
                      disabled={transcribing || submitting}
                    />
                  </label>
                )}
              </div>
            ) : (
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
            )}
            {answerError && <p className="form-message error" role="alert">{answerError}</p>}
            <button
              className="primary-btn"
              type="submit"
              disabled={submitting || recording || transcribing || !answer.trim()}
            >
              {submitting ? "Evaluating answer..." : "Submit answer"}
            </button>
          </form>
            </>
          )}
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
