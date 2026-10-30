import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Literal, NoReturn

import bcrypt
from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError, PyMongoError
from pydantic import BaseModel, Field, field_validator, model_validator

from config import load_backend_environment
from auth import SESSION_COOKIE, create_session, get_current_user
from database import close_mongo_client, get_db, next_id
from interview_service import (
    AIServiceError,
    analyze_job_description,
    chat_reply,
    evaluate_answer as evaluate_candidate_answer,
    generate_questions,
    generate_report,
    transcribe_audio,
)
from security import ensure_session_secret


load_backend_environment()


def initialize_database():
    database = get_db()
    database.users.create_index([("id", ASCENDING)], unique=True)
    database.users.create_index([("username_key", ASCENDING)], unique=True)
    database.users.create_index([("email_key", ASCENDING)], unique=True)
    database.interviews.create_index([("id", ASCENDING)], unique=True)
    database.interviews.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    database.interview_questions.create_index([("id", ASCENDING)], unique=True)
    database.interview_questions.create_index(
        [("interview_id", ASCENDING), ("id", ASCENDING)]
    )
    database.interview_reports.create_index([("id", ASCENDING)], unique=True)
    database.interview_reports.create_index([("interview_id", ASCENDING)], unique=True)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_session_secret()
    try:
        initialize_database()
        yield
    finally:
        close_mongo_client()


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


class JobDescriptionAnalysis(BaseModel):
    role_title: str
    seniority: str
    summary: str
    required_skills: list[str]
    preferred_skills: list[str]
    qualifications: list[str]
    responsibilities: list[str]
    interview_focus: list[str]


class InterviewCreateData(BaseModel):
    role: str | None = Field(default=None, min_length=2, max_length=120)
    interview_type: Literal["Technical", "HR", "Behavioral", "Mixed"]
    difficulty: Literal["Beginner", "Intermediate", "Advanced"]
    question_count: int = Field(default=5, ge=1, le=10)
    job_description: str | None = Field(default=None, min_length=50, max_length=20000)
    job_context: JobDescriptionAnalysis | None = None

    @model_validator(mode="after")
    def role_or_job_description_required(self):
        has_role = bool(self.role and self.role.strip())
        has_description = bool(self.job_description and self.job_description.strip())
        analyzed_role = (
            self.job_context.role_title.strip()
            if self.job_context and self.job_context.role_title.strip().casefold() != "not specified"
            else ""
        )
        if not (has_role or has_description or analyzed_role):
            raise ValueError("Provide a role or a job description.")
        return self

    @field_validator("job_description")
    @classmethod
    def job_description_is_not_blank(cls, value: str | None) -> str | None:
        if value is not None:
            value = value.strip()
            if len(value) < 50:
                raise ValueError("Job description must contain at least 50 non-whitespace characters.")
        return value


class TranscriptionResponse(BaseModel):
    transcript: str


class JobDescriptionData(BaseModel):
    job_description: str = Field(min_length=50, max_length=20000)

    @field_validator("job_description")
    @classmethod
    def job_description_is_not_blank(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 50:
            raise ValueError("Job description must contain at least 50 non-whitespace characters.")
        return value


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
    database = get_db()
    username = data.username.strip()
    email = data.email.strip().lower()
    password_hash = bcrypt.hashpw(
        data.password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")
    try:
        existing = database.users.find_one(
            {
                "$or": [
                    {"username_key": username.casefold()},
                    {"email_key": email.casefold()},
                ]
            },
            {"_id": False},
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username or email already exists.",
            )

        database.users.insert_one(
            {
                "id": next_id(database, "users"),
                "fname": data.fname.strip(),
                "lname": data.lname.strip(),
                "username": username,
                "username_key": username.casefold(),
                "password": password_hash,
                "email": email,
                "email_key": email.casefold(),
                "contact": data.contact,
            }
        )
    except DuplicateKeyError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already exists.",
        ) from error
    return {"success": True, "message": "Registration successful"}


@app.post("/login")
def login(data: LoginData, response: Response):
    account = get_db().users.find_one(
        {"username_key": data.username.strip().casefold()},
        {"_id": False},
    )

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
    job_context = data.job_context.model_dump() if data.job_context else None
    role = data.role.strip() if data.role else ""
    if data.job_description and not job_context:
        try:
            job_context = analyze_job_description(data.job_description)
        except AIServiceError as error:
            raise_ai_http_error(error)
    if job_context and (not role or job_context["role_title"].casefold() != "not specified"):
        role = job_context["role_title"]

    try:
        questions = generate_questions(
            role=role,
            interview_type=data.interview_type,
            difficulty=data.difficulty,
            count=data.question_count,
            job_context=job_context,
        )
    except AIServiceError as error:
        raise_ai_http_error(error)

    database = get_db()
    now = datetime.now(timezone.utc)
    interview_id = next_id(database, "interviews")
    interview = {
        "id": interview_id,
        "user_id": user["id"],
        "role": role,
        "interview_type": data.interview_type,
        "difficulty": data.difficulty,
        "status": "in_progress",
        "current_difficulty": data.difficulty,
        "total_score": None,
        "created_at": now,
        "updated_at": now,
    }
    if job_context:
        interview["job_context"] = job_context
    question_documents = [
        {
            "id": next_id(database, "interview_questions"),
            "interview_id": interview_id,
            "question_text": question,
            "answer_text": None,
            "feedback": None,
            "score": None,
            "missing_concepts": [],
            "improved_answer": None,
            "created_at": now,
        }
        for question in questions
    ]

    database.interviews.insert_one(interview)
    try:
        if question_documents:
            database.interview_questions.insert_many(question_documents)
    except PyMongoError:
        database.interviews.delete_one({"id": interview_id})
        database.interview_questions.delete_many({"interview_id": interview_id})
        raise

    return {
        "id": interview_id,
        "interview_id": interview_id,
        "role": role,
        "interview_type": interview["interview_type"],
        "difficulty": interview["difficulty"],
        "status": interview["status"],
        "questions": [
            {"id": item["id"], "question": item["question_text"]}
            for item in question_documents
        ],
    }


MAX_AUDIO_BYTES = 20 * 1024 * 1024
SUPPORTED_AUDIO_TYPES = {
    "audio/webm",
    "audio/ogg",
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/aac",
}


def has_audio_signature(audio: bytes, content_type: str) -> bool:
    if content_type in {"audio/webm", "audio/webm;codecs=opus"}:
        return audio.startswith(b"\x1aE\xdf\xa3")
    if content_type == "audio/ogg":
        return audio.startswith(b"OggS")
    if content_type in {"audio/wav", "audio/x-wav"}:
        return audio.startswith(b"RIFF") and audio[8:12] == b"WAVE"
    if content_type in {"audio/mpeg", "audio/mp3"}:
        return audio.startswith(b"ID3") or (
            len(audio) > 1 and audio[0] == 0xFF and audio[1] & 0xE0 == 0xE0
        )
    if content_type == "audio/mp4":
        return len(audio) >= 8 and audio[4:8] == b"ftyp"
    if content_type == "audio/aac":
        return len(audio) > 1 and audio[0] == 0xFF and audio[1] & 0xF6 == 0xF0
    return False


@app.post("/api/interviews/transcribe", response_model=TranscriptionResponse)
async def transcribe_interview_answer(
    file: UploadFile = File(...),
    _user: dict = Depends(get_current_user),
):
    try:
        content_type = (file.content_type or "").split(";", maxsplit=1)[0].strip().lower()
        if content_type not in SUPPORTED_AUDIO_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Upload a WebM, Ogg, WAV, MP3, MP4, or AAC audio recording.",
            )

        audio = await file.read(MAX_AUDIO_BYTES + 1)
        if not audio:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The audio recording is empty.")
        if len(audio) > MAX_AUDIO_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Audio recordings must be 20 MB or smaller.",
            )
        if not has_audio_signature(audio, content_type):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="The uploaded file does not contain a supported audio recording.",
            )

        extension = {
            "audio/webm": "webm",
            "audio/ogg": "ogg",
            "audio/wav": "wav",
            "audio/x-wav": "wav",
            "audio/mpeg": "mp3",
            "audio/mp3": "mp3",
            "audio/mp4": "mp4",
            "audio/aac": "aac",
        }[content_type]
        try:
            transcript = transcribe_audio(
                f"recording.{extension}",
                audio,
                content_type,
            )
        except AIServiceError as error:
            raise_ai_http_error(error)
        return {"transcript": transcript}
    finally:
        await file.close()


@app.get("/interviews")
def interview_history(user: dict = Depends(get_current_user)):
    database = get_db()
    interviews = list(
        database.interviews.find(
            {"user_id": user["id"]},
            {
                "_id": False,
                "id": True,
                "role": True,
                "interview_type": True,
                "difficulty": True,
                "status": True,
                "total_score": True,
                "created_at": True,
            },
        ).sort("created_at", DESCENDING)
    )
    for interview in interviews:
        interview["question_count"] = database.interview_questions.count_documents(
            {"interview_id": interview["id"]}
        )
    return {"interviews": interviews}


def load_interview(database, interview_id: int, user_id: int):
    interview = database.interviews.find_one(
        {"id": interview_id, "user_id": user_id},
        {"_id": False},
    )
    if interview is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found.")
    return interview


@app.get("/interviews/{interview_id}")
def interview_detail(
    interview_id: int,
    user: dict = Depends(get_current_user),
):
    database = get_db()
    interview = load_interview(database, interview_id, user["id"])
    questions = list(
        database.interview_questions.find(
            {"interview_id": interview_id},
            {"_id": False},
        ).sort("id", ASCENDING)
    )
    report_document = database.interview_reports.find_one(
        {"interview_id": interview_id},
        {"_id": False},
    )
    report = (
        report_document.get("report_json") or report_document
        if report_document
        else None
    )
    return {"interview": interview, "questions": questions, "report": report}


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
    database = get_db()
    interview = load_interview(database, interview_id, user["id"])
    if interview["status"] != "in_progress":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This interview is complete.")

    questions = list(
        database.interview_questions.find(
            {"interview_id": interview_id},
            {"_id": False},
        ).sort("id", ASCENDING)
    )
    next_question = next((item for item in questions if item["answer_text"] is None), None)
    if next_question is None or next_question["id"] != data.question_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Answer the current unanswered question before continuing.",
        )
    question = next_question

    try:
        evaluation = evaluate_candidate_answer(
            role=interview["role"],
            interview_type=interview["interview_type"],
            question=question["question_text"],
            answer=data.answer.strip(),
            job_context=interview.get("job_context"),
        )
    except AIServiceError as error:
        raise_ai_http_error(error)

    remaining_questions = [
        item
        for item in questions
        if item["id"] != data.question_id and item["answer_text"] is None
    ]
    next_difficulty = interview.get("current_difficulty", interview["difficulty"])
    if evaluation["score"] >= 85:
        next_difficulty = {
            "Beginner": "Intermediate",
            "Intermediate": "Advanced",
            "Advanced": "Advanced",
        }[next_difficulty]
    elif evaluation["score"] <= 60:
        next_difficulty = {
            "Beginner": "Beginner",
            "Intermediate": "Beginner",
            "Advanced": "Intermediate",
        }[next_difficulty]

    adaptive_question = None
    if remaining_questions:
        previous_answers = [
            {
                "question": item["question_text"],
                "answer": item["answer_text"],
                "score": item["score"],
                "feedback": item["feedback"],
            }
            for item in questions
            if item["answer_text"] is not None
        ]
        previous_answers.append(
            {
                "question": question["question_text"],
                "answer": data.answer.strip(),
                "score": evaluation["score"],
                "feedback": evaluation["feedback"],
            }
        )
        try:
            adaptive_question = generate_questions(
                role=interview["role"],
                interview_type=interview["interview_type"],
                difficulty=next_difficulty,
                count=1,
                job_context=interview.get("job_context"),
                previous_answers=previous_answers,
            )[0]
        except AIServiceError as error:
            raise_ai_http_error(error)

    interview = load_interview(database, interview_id, user["id"])
    if interview["status"] != "in_progress":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This interview is complete.")

    questions = list(
        database.interview_questions.find(
            {"interview_id": interview_id},
            {"_id": False},
        ).sort("id", ASCENDING)
    )
    next_question = next((item for item in questions if item["answer_text"] is None), None)
    if next_question is None or next_question["id"] != data.question_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This question was already answered or is no longer current.",
        )

    report = None
    total_questions = len(questions)
    answered_before = [item for item in questions if item["score"] is not None]
    if total_questions and len(answered_before) + 1 == total_questions:
        report_answers = [
            {
                "question": item["question_text"],
                "answer": data.answer.strip() if item["id"] == data.question_id else item["answer_text"],
                "score": round(float(evaluation["score"] if item["id"] == data.question_id else item["score"])),
                "feedback": evaluation["feedback"] if item["id"] == data.question_id else item["feedback"],
                "missing_concepts": (
                    evaluation["missing_concepts"]
                    if item["id"] == data.question_id
                    else item["missing_concepts"]
                ),
            }
            for item in questions
        ]
        try:
            report = generate_report(
                role=interview["role"],
                interview_type=interview["interview_type"],
                answers=report_answers,
                job_context=interview.get("job_context"),
            )
        except AIServiceError as error:
            raise_ai_http_error(error)

    updated_question = database.interview_questions.update_one(
        {
            "id": data.question_id,
            "interview_id": interview_id,
            "answer_text": None,
        },
        {
            "$set": {
                "answer_text": data.answer.strip(),
                "feedback": evaluation["feedback"],
                "score": evaluation["score"],
                "missing_concepts": evaluation["missing_concepts"],
                "improved_answer": evaluation["improved_answer"],
            }
        },
    )
    if updated_question.modified_count != 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This question was already answered.",
        )

    if adaptive_question and remaining_questions:
        next_pending = remaining_questions[0]
        database.interview_questions.update_one(
            {
                "id": next_pending["id"],
                "interview_id": interview_id,
                "answer_text": None,
            },
            {"$set": {"question_text": adaptive_question, "difficulty": next_difficulty}},
        )
        database.interviews.update_one(
            {"id": interview_id, "user_id": user["id"], "status": "in_progress"},
            {"$set": {"current_difficulty": next_difficulty}},
        )

    answers = list(
        database.interview_questions.find(
            {"interview_id": interview_id},
            {"_id": False},
        ).sort("id", ASCENDING)
    )
    answered = [item for item in answers if item["score"] is not None]
    if report:
        report_document = {
            "id": next_id(database, "interview_reports"),
            "interview_id": interview_id,
            "overall_score": report["overall_score"],
            "overall_feedback": report["summary"],
            "report_json": report,
            "created_at": datetime.now(timezone.utc),
        }
        database.interview_reports.insert_one(report_document)
        completion = database.interviews.update_one(
            {"id": interview_id, "user_id": user["id"], "status": "in_progress"},
            {
                "$set": {
                    "status": "completed",
                    "total_score": report["overall_score"],
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        if completion.modified_count != 1:
            database.interview_reports.delete_one({"id": report_document["id"]})
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This interview is complete.",
            )

    return {
        "evaluation": evaluation,
        "answered": len(answered),
        "total": total_questions,
        "report": report,
    }


@app.post("/api/ai/chat")
def interview_chat(
    data: AIChatData,
    user: dict = Depends(get_current_user),
):
    interview_context = None
    if data.interview_id is not None:
        database = get_db()
        interview = load_interview(database, data.interview_id, user["id"])
        answered = list(
            database.interview_questions.find(
                {"interview_id": data.interview_id, "answer_text": {"$ne": None}},
                {
                    "_id": False,
                    "question_text": True,
                    "answer_text": True,
                    "score": True,
                    "feedback": True,
                },
            ).sort("id", ASCENDING)
        )
        interview_context = json.dumps(
            {
                "role": interview["role"],
                "interview_type": interview["interview_type"],
                "completed_answers": answered,
            },
            ensure_ascii=True,
            default=str,
        )

    try:
        reply = chat_reply(
            messages=[message.model_dump() for message in data.messages],
            interview_context=interview_context,
        )
    except AIServiceError as error:
        raise_ai_http_error(error)
    return {"reply": reply}
