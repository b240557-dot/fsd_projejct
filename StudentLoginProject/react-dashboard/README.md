# AI Interview Platform

The existing React/Vite frontend connects to the existing FastAPI backend. The backend stores student accounts, interview questions, answers, scoring, and reports in the configured MySQL database. Groq requests are made only by FastAPI.

## Run both servers in PowerShell

Open two terminals from the repository root. Install backend and frontend dependencies once:

```powershell
Set-Location .\StudentLoginProject\backend
..\.venv\Scripts\python.exe -m pip install -r requirements.txt

Set-Location ..\react-dashboard
npm install
```

**Terminal 1 — FastAPI and MySQL**

```powershell
Set-Location .\StudentLoginProject\backend
..\.venv\Scripts\python.exe -m uvicorn main:app --reload --env-file .env --host 127.0.0.1 --port 8000
```

**Terminal 2 — React/Vite**

```powershell
Set-Location .\StudentLoginProject\react-dashboard
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

The React app is served at `http://127.0.0.1:5173`. In development, Vite proxies API and session requests to FastAPI at `http://127.0.0.1:8000`, so the browser keeps the HttpOnly login cookie on the frontend origin. FastAPI also allows the Vite origins through CORS for direct API use.

## Backend environment

Set the database connection, a random `SESSION_SECRET` of at least 32 characters, `GROQ_API_KEY`, and `GROQ_MODEL=openai/gpt-oss-120b` in `StudentLoginProject/backend/.env`. Use `.env.example` as a placeholders-only template and edit the local `.env` file (for example, run `notepad .env` from the backend folder). Never put the Groq key in React, Vite variables, source control, logs, or chat. The `.env` file is ignored by Git. Keep `COOKIE_SECURE=false` for local HTTP development and set it to `true` when serving over HTTPS. Restart FastAPI after changing provider configuration. Without a valid key, AI routes return a clear provider error and do not create a partial interview.

The first backend startup creates only the missing interview tables with `CREATE TABLE IF NOT EXISTS`; it does not drop or replace existing tables or account data.

## Test the backend workflow

Install the optional test dependency and run the integration tests from `StudentLoginProject/backend`:

```powershell
..\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
..\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

The workflow test uses a uniquely named temporary account and mocked AI responses, then removes only the test account and interview it created.

## Available features

- React login/signup backed by the existing MySQL users table; the backend issues an HttpOnly signed session cookie.
- Authenticated dashboard, interview creation, question generation, answer submission/evaluation, feedback, scoring, and per-user history.
- Technical, HR, Behavioral, and Mixed interviews; detailed answer review and a final AI-generated report.
- Authenticated interview-coach chat at `/api/ai/chat`, scoped to the signed-in user's interview when an interview ID is supplied.
- Authenticated Job Description analysis at `/job-analysis`; the API extracts role level, summary, required/preferred skills, qualifications, responsibilities, and interview focus. This feature uses Groq; no pre-existing local resume/NLP analyzer was present in this project.
- Groq API calls run on the backend with the official Groq Python SDK. The API key is never included in Vite variables or browser code.

Live AI generation requires a valid `GROQ_API_KEY`; MySQL must be running and configured.

Check the active FastAPI instance at `http://127.0.0.1:8000/health`. Its
`job_description_analysis.registered` value must be `true`; the endpoint must
also appear in `http://127.0.0.1:8000/openapi.json`. Job description analysis
requires a signed-in user and returns role, seniority, skills, qualifications,
responsibilities, and interview focus.
