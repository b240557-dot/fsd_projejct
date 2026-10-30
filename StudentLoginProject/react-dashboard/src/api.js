const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";
const API_SERVER_LABEL = API_BASE_URL || "FastAPI at http://127.0.0.1:8000 (Vite proxy)";

export class ApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError("Cannot reach the backend. Check that FastAPI is running.", 0);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new ApiError("The backend returned an unreadable response.", response.status);
  }

  if (!response.ok) {
    const detail = result.detail ?? result.message;
    const message = response.status === 404 && path === "/api/ai/analyze-job-description"
      ? `The FastAPI server at ${API_SERVER_LABEL} does not have the Job Description Analysis endpoint. Check its /health route and start the current backend from StudentLoginProject/backend.`
      : response.status === 401 && path !== "/login"
        ? "Your login session is missing or expired. Please log in again."
        : Array.isArray(detail)
          ? detail.map((item) => item.msg ?? "Invalid request").join("; ")
          : typeof detail === "string"
            ? detail
            : "The request could not be completed.";
    throw new ApiError(
      message,
      response.status,
    );
  }

  return result;
}

export const api = {
  health: () => request("/health"),
  signup: (values) => request("/signup", {
    method: "POST",
    body: JSON.stringify(values),
  }),
  login: (values) => request("/login", {
    method: "POST",
    body: JSON.stringify(values),
  }),
  me: () => request("/me"),
  logout: () => request("/logout", { method: "POST" }),
  getInterviews: () => request("/interviews"),
  getInterview: (id) => request(`/interviews/${id}`),
  createInterview: (values) => request("/interviews", {
    method: "POST",
    body: JSON.stringify(values),
  }),
  generateQuestions: (values) => request("/api/ai/generate-questions", {
    method: "POST",
    body: JSON.stringify(values),
  }),
  analyzeJobDescription: (values) => request("/api/ai/analyze-job-description", {
    method: "POST",
    body: JSON.stringify(values),
  }),
  evaluateAnswer: (values) => request("/api/ai/evaluate-answer", {
    method: "POST",
    body: JSON.stringify(values),
  }),
  submitAnswer: (id, values) => request("/api/ai/evaluate-answer", {
    method: "POST",
    body: JSON.stringify({ ...values, interview_id: Number(id) }),
  }),
  transcribeAudio: (formData) => request("/api/interviews/transcribe", {
    method: "POST",
    body: formData,
  }),
  chat: (values) => request("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify(values),
  }),
};
