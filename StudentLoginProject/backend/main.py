import json
import os
from contextlib import asynccontextmanager
from typing import Literal, NoReturn

import bcrypt
import mysql.connector
from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from config import load_backend_environment
from auth import SESSION_COOKIE, create_session, get_current_user
from database import get_db
from interview_service import (
    AIServiceError,
    analyze_job_description,
    chat_reply,
    evaluate_answer as evaluate_candidate_answer,
    generate_questions,
    generate_report,
)
from security import ensure_session_secret


load_backend_environment()


def ensure_column(cursor, table: str, column: str, definition: str):
    cursor.execute(
        """
        SELECT COUNT(*)
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s
        """,
        (table, column),
    )
    if cursor.fetchone()[0] == 0:
        cursor.execute(f"ALTER TABLE `{table}` ADD COLUMN `{column}` {definition}")


def initialize_interview_tables():
    connection = get_db()
    cursor = connection.cursor()
    try:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS interviews (
                id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                role VARCHAR(120) NOT NULL,
                interview_type VARCHAR(30) NOT NULL,
                difficulty VARCHAR(30) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
                total_score DECIMAL(5, 2) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_interviews_user
                    FOREIGN KEY (user_id) REFERENCES users(id)
                    ON DELETE CASCADE,
                INDEX idx_interviews_user_created (user_id, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS interview_questions (
                id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                interview_id BIGINT NOT NULL,
                question_text TEXT NOT NULL,
                answer_text LONGTEXT NULL,
                feedback LONGTEXT NULL,
                score DECIMAL(5, 2) NULL,
                missing_concepts LONGTEXT NULL,
                improved_answer LONGTEXT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_questions_interview
                    FOREIGN KEY (interview_id) REFERENCES interviews(id)
                    ON DELETE CASCADE,
                INDEX idx_questions_interview (interview_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS interview_reports (
                id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                interview_id BIGINT NOT NULL UNIQUE,
                overall_score DECIMAL(5, 2) NOT NULL,
                overall_feedback LONGTEXT NOT NULL,
                report_json LONGTEXT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_reports_interview
                    FOREIGN KEY (interview_id) REFERENCES interviews(id)
                    ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """
        )
        ensure_column(cursor, "interview_questions", "missing_concepts", "LONGTEXT NULL")
        ensure_column(cursor, "interview_questions", "improved_answer", "LONGTEXT NULL")
        ensure_column(cursor, "interview_questions", "feedback", "LONGTEXT NULL")
        ensure_column(cursor, "interview_reports", "report_json", "LONGTEXT NULL")
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND TABLE_NAME = 'interviews'
              AND CONSTRAINT_NAME = 'fk_interviews_user'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY'
            """
        )
        if cursor.fetchone()[0] == 0:
            cursor.execute(
                """
                ALTER TABLE interviews
                ADD CONSTRAINT fk_interviews_user
                    FOREIGN KEY (user_id) REFERENCES users(id)
                    ON DELETE CASCADE
                """
            )
        cursor.execute(
            """
            SELECT DATA_TYPE
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'interview_reports'
              AND COLUMN_NAME = 'overall_feedback'
            """
        )
        feedback_type = cursor.fetchone()[0]
        if feedback_type != "longtext":
            cursor.execute(
                """
                ALTER TABLE interview_reports
                MODIFY COLUMN overall_feedback LONGTEXT NOT NULL
                """
            )
        connection.commit()
    except mysql.connector.Error:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_session_secret()
    initialize_interview_tables()
    yield


app = FastAPI(title="AI Interview Platform API", lifespan=lifespan)

origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://127.0.0.1:5173,http://localhost:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

DUMMY_PASSWORD_HASH = bcrypt.hashpw(b"unmatched-password", bcrypt.gensalt())


class SignupData(BaseModel):
    fname: str = Field(min_length=1, max_length=100)
    lname: str = Field(min_length=1, max_length=100)
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=8, max_length=72)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", min_length=3, max_length=150)
    contact: str = Field(pattern=r"^\d{10}$", max_length=15)

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes.")
        return value


class LoginData(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=200)

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes.")
        return value


class InterviewCreateData(BaseModel):
    role: str = Field(min_length=2, max_length=120)
    interview_type: Literal["Technical", "HR", "Behavioral", "Mixed"]
    difficulty: Literal["Beginner", "Intermediate", "Advanced"]
    question_count: int = Field(default=5, ge=1, le=10)


class JobDescriptionData(BaseModel):
    job_description: str = Field(min_length=50, max_length=20000)

    @field_validator("job_description")
    @classmethod
    def job_description_is_not_blank(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 50:
            raise ValueError("Job description must contain at least 50 non-whitespace characters.")
        return value


class JobDescriptionAnalysis(BaseModel):
    role_title: str
    seniority: str
    summary: str
    required_skills: list[str]
    preferred_skills: list[str]
    qualifications: list[str]
    responsibilities: list[str]
    interview_focus: list[str]


class AnswerData(BaseModel):
    question_id: int = Field(gt=0)
    answer: str = Field(min_length=1, max_length=12000)

    @field_validator("answer")
    @classmethod
    def answer_is_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Answer cannot be blank.")
        return value


class AIAnswerData(AnswerData):
    interview_id: int = Field(gt=0)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class AIChatData(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=12)
    interview_id: int | None = Field(default=None, gt=0)

    @field_validator("messages")
    @classmethod
    def last_message_must_be_from_user(cls, value: list[ChatMessage]) -> list[ChatMessage]:
        if value[-1].role != "user":
            raise ValueError("The last chat message must be from the user.")
        return value


def user_response(row: dict) -> dict:
    return {
        "id": row["id"],
        "fname": row["fname"],
        "lname": row["lname"],
        "username": row["username"],
        "email": row["email"],
    }


@app.get("/")
def home():
    return {"message": "FastAPI server is running"}


@app.get("/health")
def health():
    analysis_route_registered = any(
        getattr(route, "path", None) == "/api/ai/analyze-job-description"
        and "POST" in getattr(route, "methods", set())
        for route in app.routes
    )
    return {
        "status": "ok",
        "job_description_analysis": {
            "registered": analysis_route_registered,
            "method": "POST",
            "path": "/api/ai/analyze-job-description",
        },
    }


def raise_ai_http_error(error: AIServiceError) -> NoReturn:
    raise HTTPException(status_code=error.status_code, detail=str(error)) from error


@app.post(
    "/api/ai/analyze-job-description",
    response_model=JobDescriptionAnalysis,
    dependencies=[Depends(get_current_user)],
)
def analyze_job_description_endpoint(data: JobDescriptionData):
    try:
        return analyze_job_description(data.job_description)
    except AIServiceError as error:
        raise_ai_http_error(error)


@app.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(data: SignupData):
    connection = get_db()
    cursor = connection.cursor()
    try:
        cursor.execute(
            "SELECT id FROM users WHERE username = %s OR email = %s",
            (data.username, data.email),
        )
        existing = cursor.fetchone()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username or email already exists.",
            )

        password_hash = bcrypt.hashpw(
            data.password.encode("utf-8"),
            bcrypt.gensalt(),
        ).decode("utf-8")
        cursor.execute(
            """
            INSERT INTO users (fname, lname, username, password, email, contact)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                data.fname.strip(),
                data.lname.strip(),
                data.username.strip(),
                password_hash,
                data.email.strip().lower(),
                data.contact,
            ),
        )
        connection.commit()
        return {"success": True, "message": "Registration successful"}
    except mysql.connector.IntegrityError as error:
        connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already exists.",
        ) from error
    except mysql.connector.Error:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()


@app.post("/login")
def login(data: LoginData, response: Response):
    connection = get_db()
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT id, fname, lname, username, email, password
            FROM users
            WHERE username = %s
            """,
            (data.username.strip(),),
        )
        account = cursor.fetchone()
    finally:
        cursor.close()
        connection.close()

    password_hash = account["password"].encode("utf-8") if account else DUMMY_PASSWORD_HASH
    if not bcrypt.checkpw(data.password.encode("utf-8"), password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    user = user_response(account)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=create_session(user["id"]),
        httponly=True,
        secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
        samesite="lax",
        max_age=8 * 60 * 60,
        path="/",
    )
    return {"success": True, "message": "Login successful", "user": user}


@app.post("/logout")
def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="lax")
    return {"success": True, "message": "Logged out"}


@app.get("/me")
def me(request: Request):
    if not request.cookies.get(SESSION_COOKIE):
        return {"user": None}
    return {"user": get_current_user(request)}


@app.post("/interviews", status_code=status.HTTP_201_CREATED)
@app.post("/api/ai/generate-questions", status_code=status.HTTP_201_CREATED)
def create_interview(
    data: InterviewCreateData,
    user: dict = Depends(get_current_user),
):
    try:
        questions = generate_questions(
            role=data.role.strip(),
            interview_type=data.interview_type,
            difficulty=data.difficulty,
            count=data.question_count,
        )
    except AIServiceError as error:
        raise_ai_http_error(error)

    connection = get_db()
    cursor = connection.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO interviews (user_id, role, interview_type, difficulty)
            VALUES (%s, %s, %s, %s)
            """,
            (user["id"], data.role.strip(), data.interview_type, data.difficulty),
        )
        interview_id = cursor.lastrowid
        inserted_questions = []
        for question in questions:
            cursor.execute(
                "INSERT INTO interview_questions (interview_id, question_text) VALUES (%s, %s)",
                (interview_id, question),
            )
            inserted_questions.append({"id": cursor.lastrowid, "question": question})
        connection.commit()
        return {
            "id": interview_id,
            "interview_id": interview_id,
            "role": data.role.strip(),
            "interview_type": data.interview_type,
            "difficulty": data.difficulty,
            "status": "in_progress",
            "questions": inserted_questions,
        }
    except mysql.connector.Error:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()


@app.get("/interviews")
def interview_history(user: dict = Depends(get_current_user)):
    connection = get_db()
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT i.id, i.role, i.interview_type, i.difficulty, i.status,
                   i.total_score, i.created_at, COUNT(q.id) AS question_count
            FROM interviews AS i
            LEFT JOIN interview_questions AS q ON q.interview_id = i.id
            WHERE i.user_id = %s
            GROUP BY i.id
            ORDER BY i.created_at DESC
            """,
            (user["id"],),
        )
        return {"interviews": cursor.fetchall()}
    finally:
        cursor.close()
        connection.close()


def load_interview(cursor, interview_id: int, user_id: int, lock: bool = False):
    cursor.execute(
        """
        SELECT id, role, interview_type, difficulty, status, total_score, created_at
        FROM interviews
        WHERE id = %s AND user_id = %s
        """ + (" FOR UPDATE" if lock else ""),
        (interview_id, user_id),
    )
    interview = cursor.fetchone()
    if interview is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found.")
    return interview


@app.get("/interviews/{interview_id}")
def interview_detail(
    interview_id: int,
    user: dict = Depends(get_current_user),
):
    connection = get_db()
    cursor = connection.cursor(dictionary=True)
    try:
        interview = load_interview(cursor, interview_id, user["id"])
        cursor.execute(
            """
            SELECT id, question_text, answer_text, feedback, score,
                   missing_concepts, improved_answer
            FROM interview_questions
            WHERE interview_id = %s
            ORDER BY id
            """,
            (interview_id,),
        )
        questions = cursor.fetchall()
        for question in questions:
            question["missing_concepts"] = json.loads(question["missing_concepts"] or "[]")
        cursor.execute(
            """
            SELECT overall_score, overall_feedback, report_json, created_at
            FROM interview_reports
            WHERE interview_id = %s
            """,
            (interview_id,),
        )
        report = cursor.fetchone()
        if report and report["report_json"]:
            report = json.loads(report["report_json"])
        return {"interview": interview, "questions": questions, "report": report}
    finally:
        cursor.close()
        connection.close()


@app.post("/interviews/{interview_id}/answers")
def submit_answer(
    interview_id: int,
    data: AnswerData,
    user: dict = Depends(get_current_user),
):
    return evaluate_and_save_answer(interview_id, data, user)


@app.post("/api/ai/evaluate-answer")
def evaluate_answer_endpoint(
    data: AIAnswerData,
    user: dict = Depends(get_current_user),
):
    return evaluate_and_save_answer(data.interview_id, data, user)


def evaluate_and_save_answer(interview_id: int, data: AnswerData, user: dict):
    connection = get_db()
    cursor = connection.cursor(dictionary=True)
    try:
        interview = load_interview(cursor, interview_id, user["id"])
        if interview["status"] != "in_progress":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This interview is complete.")

        cursor.execute(
            """
            SELECT id, question_text, answer_text
            FROM interview_questions
            WHERE interview_id = %s
            ORDER BY id
            """,
            (interview_id,),
        )
        questions = cursor.fetchall()
        next_question = next((item for item in questions if item["answer_text"] is None), None)
        if next_question is None or next_question["id"] != data.question_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Answer the current unanswered question before continuing.",
            )
        question = next_question
    finally:
        cursor.close()
        connection.close()

    try:
        evaluation = evaluate_candidate_answer(
            role=interview["role"],
            interview_type=interview["interview_type"],
            question=question["question_text"],
            answer=data.answer.strip(),
        )
    except AIServiceError as error:
        raise_ai_http_error(error)

    connection = get_db()
    cursor = connection.cursor(dictionary=True)
    try:
        interview = load_interview(cursor, interview_id, user["id"], lock=True)
        if interview["status"] != "in_progress":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This interview is complete.")

        cursor.execute(
            """
            SELECT id, question_text, answer_text
            FROM interview_questions
            WHERE id = %s AND interview_id = %s
            """,
            (data.question_id, interview_id),
        )
        question = cursor.fetchone()
        if question is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")
        if question["answer_text"] is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This question was already answered.")

        cursor.execute(
            """
            UPDATE interview_questions
            SET answer_text = %s, feedback = %s, score = %s,
                missing_concepts = %s, improved_answer = %s
            WHERE id = %s AND answer_text IS NULL
            """,
            (
                data.answer.strip(),
                evaluation["feedback"],
                evaluation["score"],
                json.dumps(evaluation["missing_concepts"]),
                evaluation["improved_answer"],
                question["id"],
            ),
        )
        cursor.execute(
            """
            SELECT question_text, answer_text, score, feedback, missing_concepts
            FROM interview_questions
            WHERE interview_id = %s
            ORDER BY id
            """,
            (interview_id,),
        )
        answers = cursor.fetchall()
        total_questions = len(answers)
        answered = [item for item in answers if item["score"] is not None]
        report = None
        if total_questions and len(answered) == total_questions:
            report_answers = [
                {
                    "question": item["question_text"],
                    "answer": item["answer_text"],
                    "score": round(float(item["score"])),
                    "feedback": item["feedback"],
                    "missing_concepts": json.loads(item["missing_concepts"] or "[]"),
                }
                for item in answered
            ]
            try:
                report = generate_report(
                    role=interview["role"],
                    interview_type=interview["interview_type"],
                    answers=report_answers,
                )
            except AIServiceError as error:
                raise_ai_http_error(error)
            cursor.execute(
                "UPDATE interviews SET status = 'completed', total_score = %s WHERE id = %s",
                (report["overall_score"], interview_id),
            )
            cursor.execute(
                """
                INSERT INTO interview_reports
                    (interview_id, overall_score, overall_feedback, report_json)
                VALUES (%s, %s, %s, %s)
                """,
                (
                    interview_id,
                    report["overall_score"],
                    report["summary"],
                    json.dumps(report, ensure_ascii=True),
                ),
            )
        connection.commit()
        return {
            "evaluation": evaluation,
            "answered": len(answered),
            "total": total_questions,
            "report": report,
        }
    except HTTPException:
        connection.rollback()
        raise
    except mysql.connector.Error:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()


@app.post("/api/ai/chat")
def interview_chat(
    data: AIChatData,
    user: dict = Depends(get_current_user),
):
    interview_context = None
    if data.interview_id is not None:
        connection = get_db()
        cursor = connection.cursor(dictionary=True)
        try:
            interview = load_interview(cursor, data.interview_id, user["id"])
            cursor.execute(
                """
                SELECT question_text, answer_text, score, feedback
                FROM interview_questions
                WHERE interview_id = %s AND answer_text IS NOT NULL
                ORDER BY id
                """,
                (data.interview_id,),
            )
            answered = cursor.fetchall()
            interview_context = json.dumps(
                {
                    "role": interview["role"],
                    "interview_type": interview["interview_type"],
                    "completed_answers": answered,
                },
                ensure_ascii=True,
                default=str,
            )
        finally:
            cursor.close()
            connection.close()

    try:
        reply = chat_reply(
            messages=[message.model_dump() for message in data.messages],
            interview_context=interview_context,
        )
    except AIServiceError as error:
        raise_ai_http_error(error)
    return {"reply": reply}
