import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Brain } from "lucide-react";
import { api } from "./api";

function Practice() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    values.question_count = Number(values.question_count);

    try {
      const interview = await api.generateQuestions(values);
      navigate(`/interviews/${interview.interview_id}`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="content-card practice-card">
      <span className="eyebrow">AI INTERVIEW PRACTICE</span>
      <h1>Set up your interview</h1>
      <p className="muted">Choose the role and format. The backend will generate questions and evaluate your answers.</p>

      <form className="practice-form" onSubmit={handleSubmit}>
        <label>Role or position
          <input name="role" placeholder="e.g. Frontend Developer" minLength="2" maxLength="120" required />
        </label>
        <div className="form-grid">
          <label>Interview type
            <select name="interview_type" defaultValue="Technical">
              <option>Technical</option>
              <option>HR</option>
              <option>Behavioral</option>
              <option>Mixed</option>
            </select>
          </label>
          <label>Difficulty
            <select name="difficulty" defaultValue="Intermediate">
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </label>
        </div>
        <label>Number of questions
          <select name="question_count" defaultValue="5">
            <option value="3">3 questions</option>
            <option value="5">5 questions</option>
            <option value="8">8 questions</option>
            <option value="10">10 questions</option>
          </select>
        </label>
        {error && <p className="form-message error" role="alert">{error}</p>}
        <button className="primary-btn" type="submit" disabled={isSubmitting}>
          <Brain size={18} />
          {isSubmitting ? "Generating questions..." : "Start interview"}
          {!isSubmitting && <ArrowRight size={17} />}
        </button>
      </form>
    </section>
  );
}

export default Practice;
