import io
import os
import tempfile
import unittest
import uuid
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import httpx
import mongomock
from fastapi.testclient import TestClient
from groq import APITimeoutError, AuthenticationError, RateLimitError

import interview_service
import main
import config


class InterviewWorkflowTests(unittest.TestCase):
    def test_authenticated_workflow_persists_to_mongodb(self):
        suffix = uuid.uuid4().hex
        username = f"it_{suffix}"
        email = f"{suffix}@example.test"
        other_username = f"it_other_{suffix}"
        other_email = f"other_{suffix}@example.test"
        created_user = False
        created_other_user = False
        mongo_client = mongomock.MongoClient()
        database = mongo_client["login_db"]

        with (
            patch.object(main, "get_db", return_value=database),
            patch("auth.get_db", return_value=database),
            patch.dict(
                os.environ,
                {
                    "SESSION_SECRET": "test-session-secret-with-more-than-32-characters",
                    "COOKIE_SECURE": "false",
                },
            ),
            TestClient(main.app) as client,
        ):
            try:
                self.assertEqual(client.get("/").status_code, 200)
                health = client.get("/health")
                self.assertEqual(health.status_code, 200)
                self.assertEqual(
                    health.json()["job_description_analysis"],
                    {
                        "registered": True,
                        "method": "POST",
                        "path": "/api/ai/analyze-job-description",
                    },
                )
                self.assertIn("/api/ai/analyze-job-description", main.app.openapi()["paths"])
                self.assertEqual(client.get("/interviews").status_code, 401)
                self.assertEqual(
                    client.post(
                        "/api/interviews/transcribe",
                        files={"file": ("answer.webm", b"\x1aE\xdf\xa3data", "audio/webm")},
                    ).status_code,
                    401,
                )
                self.assertEqual(
                    client.post(
                        "/api/ai/analyze-job-description",
                        json={"job_description": "A job description with enough characters for analysis."},
                    ).status_code,
                    401,
                )

                missing_key_response = client.post(
                    "/api/ai/generate-questions",
                    json={
                        "role": "Software Engineer",
                        "interview_type": "Technical",
                        "difficulty": "Intermediate",
                        "question_count": 2,
                    },
                )
                self.assertEqual(missing_key_response.status_code, 401)

                signup = client.post(
                    "/signup",
                    json={
                        "fname": "Integration",
                        "lname": "Test",
                        "username": username,
                        "password": "Integration-Check-123",
                        "email": email,
                        "contact": "1234567890",
                    },
                )
                self.assertEqual(signup.status_code, 201, signup.text)
                created_user = True

                invalid_login = client.post(
                    "/login",
                    json={"username": username, "password": "incorrect-password"},
                )
                self.assertEqual(invalid_login.status_code, 401)

                login = client.post(
                    "/login",
                    json={"username": username, "password": "Integration-Check-123"},
                )
                self.assertEqual(login.status_code, 200, login.text)
                self.assertIn("httponly", login.headers["set-cookie"].lower())
                self.assertIn("samesite=lax", login.headers["set-cookie"].lower())
                self.assertEqual(client.get("/me").json()["user"]["username"], username)

                with patch.object(main, "transcribe_audio", return_value="I would test the API.") as transcribe:
                    transcript = client.post(
                        "/api/interviews/transcribe",
                        files={"file": ("answer.webm", b"\x1aE\xdf\xa3audio-bytes", "audio/webm")},
                    )
                self.assertEqual(transcript.status_code, 200, transcript.text)
                self.assertEqual(transcript.json(), {"transcript": "I would test the API."})
                transcribe.assert_called_once()

                invalid_audio = client.post(
                    "/api/interviews/transcribe",
                    files={"file": ("answer.webm", b"not-audio", "audio/webm")},
                )
                self.assertEqual(invalid_audio.status_code, 415)

                invalid_job_description = client.post(
                    "/api/ai/analyze-job-description",
                    json={"job_description": "too short"},
                )
                self.assertEqual(invalid_job_description.status_code, 422)

                with patch.object(
                    main,
                    "analyze_job_description",
                    side_effect=interview_service.AIServiceError(
                        "GROQ_API_KEY is missing. Add your key to backend/.env and restart FastAPI.",
                        503,
                    ),
                ):
                    missing_analysis_key = client.post(
                        "/api/ai/analyze-job-description",
                        json={
                            "job_description": (
                                "Backend Engineer: build and maintain Python services with FastAPI, "
                                "design APIs, write tests, and collaborate with the product team."
                            )
                        },
                    )
                self.assertEqual(missing_analysis_key.status_code, 503)
                self.assertIn("GROQ_API_KEY", missing_analysis_key.json()["detail"])

                job_analysis = {
                    "role_title": "Backend Engineer",
                    "seniority": "Mid-level",
                    "summary": "Build and maintain backend services.",
                    "required_skills": ["Python", "FastAPI"],
                    "preferred_skills": ["Docker"],
                    "qualifications": ["Bachelor's degree or equivalent experience"],
                    "responsibilities": ["Design APIs"],
                    "interview_focus": ["API design", "Testing"],
                }
                with patch.object(main, "analyze_job_description", return_value=job_analysis) as analyze:
                    analyzed = client.post(
                        "/api/ai/analyze-job-description",
                        json={
                            "job_description": (
                                "Backend Engineer: build and maintain Python services with FastAPI, "
                                "design APIs, write tests, and collaborate with the product team."
                            )
                        },
                    )
                self.assertEqual(analyzed.status_code, 200, analyzed.text)
                self.assertEqual(analyzed.json(), job_analysis)
                analyze.assert_called_once()

                with patch.dict(os.environ, {"GROQ_API_KEY": ""}):
                    with patch.object(interview_service, "dotenv_values", return_value={}):
                        with patch.object(config, "load_dotenv"):
                            with patch.object(config, "dotenv_values", return_value={}):
                                missing_key = client.post(
                                    "/api/ai/generate-questions",
                                    json={
                                        "role": "Software Engineer",
                                        "interview_type": "Technical",
                                        "difficulty": "Intermediate",
                                        "question_count": 2,
                                    },
                                )
                self.assertEqual(missing_key.status_code, 503)
                self.assertIn("GROQ_API_KEY", missing_key.json()["detail"])

                job_description = (
                    "Software Engineer with Python and FastAPI experience. Design reliable APIs, "
                    "write automated tests, and collaborate with product teams."
                )
                interview_analysis = {
                    **job_analysis,
                    "role_title": "Software Engineer",
                }
                with patch.object(
                    main,
                    "analyze_job_description",
                    return_value=interview_analysis,
                ) as analyze, patch.object(
                    main,
                    "generate_questions",
                    return_value=["Question one?", "Question two?"],
                ) as generate:
                    created = client.post(
                        "/api/ai/generate-questions",
                        json={
                            "role": "Software Engineer",
                            "job_description": job_description,
                            "interview_type": "Technical",
                            "difficulty": "Intermediate",
                            "question_count": 2,
                        },
                    )
                self.assertEqual(created.status_code, 201, created.text)
                analyze.assert_called_once_with(job_description)
                self.assertEqual(generate.call_args.kwargs["job_context"], interview_analysis)
                interview_id = created.json()["id"]
                question_ids = [item["id"] for item in created.json()["questions"]]

                with patch.object(main, "analyze_job_description") as repeated_analysis, patch.object(
                    main,
                    "generate_questions",
                    return_value=["A question based on analyzed requirements?"],
                ):
                    selected_analysis = client.post(
                        "/interviews",
                        json={
                            "role": "Software Engineer",
                            "job_context": interview_analysis,
                            "interview_type": "Technical",
                            "difficulty": "Intermediate",
                            "question_count": 1,
                        },
                    )
                self.assertEqual(selected_analysis.status_code, 201, selected_analysis.text)
                repeated_analysis.assert_not_called()

                out_of_order = client.post(
                    "/api/ai/evaluate-answer",
                    json={
                        "interview_id": interview_id,
                        "question_id": question_ids[1],
                        "answer": "An answer for the next question.",
                    },
                )
                self.assertEqual(out_of_order.status_code, 409)

                evaluations = [
                    {
                        "score": 81,
                        "feedback": "Clear explanation; add a concrete result.",
                        "missing_concepts": ["A measurable result"],
                        "improved_answer": "I would test using unit and integration tests, then measure coverage.",
                    },
                    {
                        "score": 93,
                        "feedback": "Strong answer with a relevant example.",
                        "missing_concepts": [],
                        "improved_answer": "I would first assess impact, communicate, and restore service.",
                    },
                ]
                final_report = {
                    "overall_score": 87,
                    "summary": "Strong interview with clear examples.",
                    "strengths": ["Clear communication"],
                    "areas_to_improve": ["Add measurable outcomes"],
                    "recommendations": ["Practice concise STAR answers"],
                }
                with patch.object(main, "evaluate_candidate_answer", side_effect=evaluations), patch.object(
                    main, "generate_report", return_value=final_report
                ), patch.object(
                    main,
                    "generate_questions",
                    return_value=["Adaptive follow-up question?"],
                ) as generate_follow_up:
                    first = client.post(
                        "/api/ai/evaluate-answer",
                        json={
                            "interview_id": interview_id,
                            "question_id": question_ids[0],
                            "answer": "My first answer.",
                        },
                    )
                    self.assertEqual(first.status_code, 200, first.text)
                    self.assertIsNone(first.json()["report"])
                    self.assertEqual(
                        generate_follow_up.call_args.kwargs["previous_answers"][-1]["answer"],
                        "My first answer.",
                    )

                    second = client.post(
                        "/api/ai/evaluate-answer",
                        json={
                            "interview_id": interview_id,
                            "question_id": question_ids[1],
                            "answer": "My second answer.",
                        },
                    )
                self.assertEqual(second.status_code, 200, second.text)
                self.assertEqual(second.json()["report"]["overall_score"], 87)
                self.assertEqual(second.json()["evaluation"]["missing_concepts"], [])

                detail = client.get(f"/interviews/{interview_id}")
                self.assertEqual(detail.status_code, 200, detail.text)
                self.assertEqual(detail.json()["interview"]["status"], "completed")
                self.assertEqual(detail.json()["questions"][0]["answer_text"], "My first answer.")
                self.assertEqual(detail.json()["questions"][1]["question_text"], "Adaptive follow-up question?")
                self.assertEqual(detail.json()["questions"][0]["score"], 81)
                self.assertEqual(detail.json()["questions"][0]["missing_concepts"], ["A measurable result"])
                self.assertIn("measure coverage", detail.json()["questions"][0]["improved_answer"])
                self.assertEqual(detail.json()["report"]["overall_score"], 87)
                self.assertEqual(detail.json()["report"]["strengths"], ["Clear communication"])
                self.assertEqual(len(client.get("/interviews").json()["interviews"]), 2)

                with patch.object(main, "chat_reply", return_value="Use the STAR format."):
                    chat = client.post(
                        "/api/ai/chat",
                        json={
                            "interview_id": interview_id,
                            "messages": [{"role": "user", "content": "How can I improve?"}],
                        },
                    )
                self.assertEqual(chat.status_code, 200, chat.text)
                self.assertEqual(chat.json()["reply"], "Use the STAR format.")

                cors = client.options(
                    "/api/ai/chat",
                    headers={
                        "Origin": "http://127.0.0.1:5173",
                        "Access-Control-Request-Method": "POST",
                    },
                )
                self.assertEqual(cors.headers["access-control-allow-origin"], "http://127.0.0.1:5173")

                self.assertEqual(client.post("/logout").status_code, 200)

                other_signup = client.post(
                    "/signup",
                    json={
                        "fname": "Other",
                        "lname": "Candidate",
                        "username": other_username,
                        "password": "Integration-Check-123",
                        "email": other_email,
                        "contact": "1234567891",
                    },
                )
                self.assertEqual(other_signup.status_code, 201, other_signup.text)
                created_other_user = True
                other_login = client.post(
                    "/login",
                    json={"username": other_username, "password": "Integration-Check-123"},
                )
                self.assertEqual(other_login.status_code, 200, other_login.text)
                self.assertEqual(client.get(f"/interviews/{interview_id}").status_code, 404)
                self.assertEqual(
                    client.post(
                        "/api/ai/evaluate-answer",
                        json={
                            "interview_id": interview_id,
                            "question_id": question_ids[0],
                            "answer": "An unauthorized answer.",
                        },
                    ).status_code,
                    404,
                )
                self.assertEqual(
                    client.post(
                        "/api/ai/chat",
                        json={
                            "interview_id": interview_id,
                            "messages": [{"role": "user", "content": "Show this interview"}],
                        },
                    ).status_code,
                    404,
                )
                self.assertEqual(client.post("/logout").status_code, 200)
                self.assertEqual(client.get("/interviews").status_code, 401)
            finally:
                if created_user or created_other_user:
                    for test_username in (
                        username if created_user else None,
                        other_username if created_other_user else None,
                    ):
                        if not test_username:
                            continue
                        test_user = database.users.find_one(
                            {"username_key": test_username.casefold()}
                        )
                        if test_user:
                            interview_ids = [
                                interview["id"]
                                for interview in database.interviews.find(
                                    {"user_id": test_user["id"]},
                                    {"id": True},
                                )
                            ]
                            database.interview_questions.delete_many(
                                {"interview_id": {"$in": interview_ids}}
                            )
                            database.interview_reports.delete_many(
                                {"interview_id": {"$in": interview_ids}}
                            )
                            database.interviews.delete_many({"user_id": test_user["id"]})
                            database.users.delete_one({"id": test_user["id"]})
                        self.assertIsNone(
                            database.users.find_one(
                                {"username_key": test_username.casefold()}
                            )
                        )
                mongo_client.close()


class GroqServiceTests(unittest.TestCase):
    def test_setting_does_not_print_secret_values(self):
        secret = "test-secret-that-must-not-be-logged"
        output = io.StringIO()
        with patch.dict(os.environ, {"GROQ_API_KEY": secret}):
            with redirect_stdout(output):
                configured_key = interview_service._setting("GROQ_API_KEY")

        self.assertEqual(configured_key, secret)
        self.assertEqual(output.getvalue(), "")

    def test_blank_environment_values_fall_back_to_backend_env(self):
        with patch.dict(os.environ, {"SESSION_SECRET": ""}):
            with patch.object(config, "load_dotenv"):
                with patch.object(
                    config,
                    "dotenv_values",
                    return_value={"SESSION_SECRET": "test-session-secret-with-at-least-32-characters"},
                ):
                    config.load_backend_environment()
            self.assertEqual(
                os.environ["SESSION_SECRET"],
                "test-session-secret-with-at-least-32-characters",
            )

    def test_job_description_analysis_returns_validated_structured_data(self):
        response = (
            '{"role_title":"Backend Engineer","seniority":"Mid-level",'
            '"summary":"Build backend services.",'
            '"required_skills":["Python","FastAPI"],'
            '"preferred_skills":["Docker"],'
            '"qualifications":["Relevant degree or equivalent experience"],'
            '"responsibilities":["Design APIs"],'
            '"interview_focus":["API design","Testing"]}'
        )

        class FakeGroq:
            def __init__(self, api_key, **_kwargs):
                self.api_key = api_key
                self.chat = SimpleNamespace(
                    completions=SimpleNamespace(create=self.create),
                )

            def create(self, **_kwargs):
                message = SimpleNamespace(content=response)
                return SimpleNamespace(choices=[SimpleNamespace(message=message)])

        with patch.dict(os.environ, {"GROQ_API_KEY": "test-key", "GROQ_MODEL": "test-model"}):
            with patch.object(interview_service, "Groq", FakeGroq):
                analysis = interview_service.analyze_job_description(
                    "Backend Engineer requiring Python and FastAPI. Build, test, and maintain services."
                )

        self.assertEqual(analysis["role_title"], "Backend Engineer")
        self.assertEqual(analysis["required_skills"], ["Python", "FastAPI"])
        self.assertEqual(analysis["interview_focus"], ["API design", "Testing"])

    def test_generation_and_evaluation_use_server_side_groq_client(self):
        responses = [
            '{"questions":["How do you test a feature?","How do you handle an outage?"]}',
            (
                '{"score":88,"feedback":"Good structure and a clear example.",'
                '"missing_concepts":["A specific outcome"],"improved_answer":"I would test it and measure results."}'
            ),
            (
                '{"summary":"Consistent answers.","strengths":["Clear examples"],'
                '"areas_to_improve":["Quantify results"],"recommendations":["Practice STAR"]}'
            ),
            "Ask clarifying questions and structure your response.",
        ]

        class FakeGroq:
            def __init__(self, api_key, **_kwargs):
                self.api_key = api_key
                self.chat = SimpleNamespace(
                    completions=SimpleNamespace(create=self.create),
                )

            def create(self, **_kwargs):
                content = responses.pop(0)
                message = SimpleNamespace(content=content)
                return SimpleNamespace(choices=[SimpleNamespace(message=message)])

        with patch.dict(os.environ, {"GROQ_API_KEY": "test-key", "GROQ_MODEL": "test-model"}):
            with patch.object(interview_service, "Groq", FakeGroq):
                questions = interview_service.generate_questions(
                    "Engineer",
                    "Technical",
                    "Intermediate",
                    2,
                )
                evaluation = interview_service.evaluate_answer(
                    "Engineer",
                    "Technical",
                    questions[0],
                    "I would test the feature with unit and integration tests.",
                )
                report = interview_service.generate_report(
                    "Engineer",
                    "Technical",
                    [
                        {
                            "question": questions[0],
                            "answer": "I would test it.",
                            "score": evaluation["score"],
                            "feedback": evaluation["feedback"],
                        }
                    ],
                )
                reply = interview_service.chat_reply([{"role": "user", "content": "How do I prepare?"}])

        self.assertEqual(len(questions), 2)
        self.assertEqual(evaluation["score"], 88)
        self.assertIn("clear example", evaluation["feedback"])
        self.assertEqual(evaluation["missing_concepts"], ["A specific outcome"])
        self.assertIn("measure results", evaluation["improved_answer"])
        self.assertEqual(report["overall_score"], 88)
        self.assertEqual(report["strengths"], ["Clear examples"])
        self.assertIn("clarifying questions", reply)

    def test_audio_transcription_uses_groq_stt_model(self):
        create_transcription = Mock(return_value=SimpleNamespace(text="  Spoken response.  "))
        client = SimpleNamespace(
            audio=SimpleNamespace(
                transcriptions=SimpleNamespace(create=create_transcription),
            )
        )
        audio = b"\x1aE\xdf\xa3recording-data"

        with patch.object(interview_service, "_client", return_value=client), patch.object(
            interview_service,
            "_setting",
            return_value="",
        ):
            transcript = interview_service.transcribe_audio("answer.webm", audio, "audio/webm")

        self.assertEqual(transcript, "Spoken response.")
        create_transcription.assert_called_once_with(
            file=("answer.webm", audio, "audio/webm"),
            model="whisper-large-v3-turbo",
            response_format="json",
            timeout=60.0,
        )

    def test_missing_groq_key_has_clear_configuration_error(self):
        with patch.dict(os.environ, {"GROQ_API_KEY": "", "GROQ_MODEL": "test-model"}):
            with patch.object(interview_service, "dotenv_values", return_value={}):
                with self.assertRaises(interview_service.AIServiceError) as error:
                    interview_service.generate_questions("Engineer", "Technical", "Intermediate", 1)

        self.assertEqual(error.exception.status_code, 503)
        self.assertIn("backend/.env", str(error.exception))

    def test_groq_api_key_is_used_with_groq_client(self):
        class FakeGroq:
            def __init__(self, api_key, **_kwargs):
                self.api_key = api_key

        with patch.dict(
            os.environ,
            {"GROQ_API_KEY": "gsk_test-placeholder", "GROQ_MODEL": "openai/gpt-oss-120b"},
        ):
            with patch.object(interview_service, "Groq", FakeGroq):
                client = interview_service._client()

        self.assertEqual(client.api_key, "gsk_test-placeholder")

    def test_example_key_placeholder_is_treated_as_missing(self):
        with patch.dict(
            os.environ,
            {
                "GROQ_API_KEY": "replace-with-your-groq-api-key",
                "GROQ_MODEL": "openai/gpt-oss-120b",
            },
        ):
            with patch.object(
                interview_service,
                "dotenv_values",
                return_value={"GROQ_API_KEY": "replace-with-your-groq-api-key"},
            ):
                with self.assertRaises(interview_service.AIServiceError) as error:
                    interview_service.generate_questions("Engineer", "Technical", "Intermediate", 1)

        self.assertEqual(error.exception.status_code, 503)
        self.assertIn("GROQ_API_KEY is missing", str(error.exception))

    def test_blank_process_environment_falls_back_to_backend_env_file(self):
        class FakeGroq:
            def __init__(self, api_key, **_kwargs):
                self.api_key = api_key

        with patch.dict(os.environ, {"GROQ_API_KEY": "", "GROQ_MODEL": ""}):
            with patch.object(
                interview_service,
                "dotenv_values",
                return_value={"GROQ_API_KEY": "local-test-key", "GROQ_MODEL": "test-model"},
            ):
                with patch.object(interview_service, "Groq", FakeGroq):
                    client = interview_service._client()

        self.assertEqual(client.api_key, "local-test-key")

    def test_client_loads_settings_from_absolute_backend_env_path(self):
        class FakeGroq:
            def __init__(self, api_key, **_kwargs):
                self.api_key = api_key

        with tempfile.TemporaryDirectory() as directory:
            env_path = Path(directory) / ".env"
            env_path.write_text(
                "GROQ_API_KEY=local-test-key\nGROQ_MODEL=test-model\n",
                encoding="utf-8",
            )
            with patch.dict(os.environ, {"GROQ_API_KEY": "", "GROQ_MODEL": ""}):
                with patch.object(interview_service, "BACKEND_ENV_PATH", env_path):
                    with patch.object(interview_service, "Groq", FakeGroq):
                        client = interview_service._client()

        self.assertTrue(env_path.is_absolute())
        self.assertEqual(client.api_key, "local-test-key")

    def test_placeholder_process_environment_falls_back_to_backend_env_file(self):
        class FakeGroq:
            def __init__(self, api_key, **_kwargs):
                self.api_key = api_key

        with patch.dict(
            os.environ,
            {"GROQ_API_KEY": "your-groq-api-key", "GROQ_MODEL": "your-supported-groq-model"},
        ):
            with patch.object(
                interview_service,
                "dotenv_values",
                return_value={"GROQ_API_KEY": "local-test-key", "GROQ_MODEL": "test-model"},
            ):
                with patch.object(interview_service, "Groq", FakeGroq):
                    client = interview_service._client()

        self.assertEqual(client.api_key, "local-test-key")

    def test_groq_provider_errors_are_safely_mapped(self):
        request = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
        response = httpx.Response(401, request=request)
        cases = (
            (
                AuthenticationError("invalid key", response=response, body=None),
                503,
                "rejected the configured API key",
            ),
            (
                RateLimitError("rate limit", response=httpx.Response(429, request=request), body=None),
                429,
                "rate limit or quota",
            ),
            (APITimeoutError(request), 504, "timed out"),
        )

        with patch.dict(os.environ, {"GROQ_API_KEY": "test-key", "GROQ_MODEL": "test-model"}):
            for provider_error, expected_status, expected_message in cases:
                class FailingGroq:
                    def __init__(self, **_kwargs):
                        self.chat = SimpleNamespace(
                            completions=SimpleNamespace(create=self.create),
                        )

                    def create(self, **_kwargs):
                        raise provider_error

                with self.subTest(provider_error=type(provider_error).__name__):
                    with patch.object(interview_service, "Groq", FailingGroq):
                        with self.assertRaises(interview_service.AIServiceError) as error:
                            interview_service.generate_questions("Engineer", "Technical", "Intermediate", 1)

                    self.assertEqual(error.exception.status_code, expected_status)
                    self.assertIn(expected_message, str(error.exception))
                    self.assertNotIn("test-key", str(error.exception))


if __name__ == "__main__":
    unittest.main()
