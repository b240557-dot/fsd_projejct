import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileSearch, Sparkles } from "lucide-react";
import { api } from "./api";
import MarkdownContent from "./MarkdownContent";

const analysisSections = [
  ["required_skills", "Required skills"],
  ["preferred_skills", "Preferred skills"],
  ["qualifications", "Qualifications"],
  ["responsibilities", "Key responsibilities"],
  ["interview_focus", "Suggested interview focus"],
];

function AnalysisList({ title, items }) {
  return (
    <section className="job-analysis-section">
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul>{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul>
      ) : (
        <p className="muted">No details identified.</p>
      )}
    </section>
  );
}

function JobDescriptionAnalysis() {
  const navigate = useNavigate();
  const [jobDescription, setJobDescription] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setAnalysis(null);
    setIsSubmitting(true);
    try {
      const result = await api.analyzeJobDescription({
        job_description: jobDescription.trim(),
      });
      setAnalysis(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="content-card practice-card job-analysis-card">
      <span className="eyebrow">JOB DESCRIPTION ANALYSIS</span>
      <h1>Understand the role</h1>
      <p className="muted">
        Paste a job description to extract its requirements and prepare focused interview topics.
        Your text is analyzed by the backend; API credentials are never sent to the browser.
      </p>

      <form className="practice-form" onSubmit={handleSubmit}>
        <label htmlFor="job-description">Job description
          <textarea
            id="job-description"
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            minLength={50}
            maxLength={20000}
            rows={10}
            placeholder="Paste the full job description here (at least 50 characters)..."
            required
          />
        </label>
        {error && <p className="form-message error" role="alert">{error}</p>}
        <button
          className="primary-btn"
          type="submit"
          disabled={isSubmitting || jobDescription.trim().length < 50}
        >
          <Sparkles size={18} />
          {isSubmitting ? "Analyzing description..." : "Analyze job description"}
        </button>
      </form>

      {analysis && (
        <section className="job-analysis-results" aria-live="polite">
          <div className="job-analysis-heading">
            <FileSearch size={22} aria-hidden="true" />
            <div>
              <span className="eyebrow">ANALYSIS</span>
              <h2>{analysis.role_title}</h2>
              <p className="job-analysis-seniority">{analysis.seniority}</p>
            </div>
          </div>
          <MarkdownContent className="job-analysis-summary">{analysis.summary}</MarkdownContent>
          <div className="job-analysis-grid">
            {analysisSections.map(([field, title]) => (
              <AnalysisList key={field} title={title} items={analysis[field]} />
            ))}
          </div>
          <button
            className="primary-btn"
            type="button"
            onClick={() => navigate("/practice", {
              state: { jobDescription, jobContext: analysis },
            })}
          >
            Use this analysis for an interview
          </button>
        </section>
      )}
    </section>
  );
}

export default JobDescriptionAnalysis;
