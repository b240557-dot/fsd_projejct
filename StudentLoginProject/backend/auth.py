from fastapi import HTTPException, Request, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from database import get_db
from security import ensure_session_secret


SESSION_COOKIE = "interview_session"
SESSION_TTL_SECONDS = 8 * 60 * 60


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(ensure_session_secret(), salt="interview-platform-session")


def create_session(user_id: int) -> str:
    return _serializer().dumps({"user_id": user_id})


def get_current_user(request: Request) -> dict:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Please log in.")

    try:
        payload = _serializer().loads(token, max_age=SESSION_TTL_SECONDS)
        user_id = int(payload["user_id"])
    except (BadSignature, SignatureExpired, KeyError, TypeError, ValueError) as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please log in again.") from error

    user = get_db().users.find_one(
        {"id": user_id},
        {
            "_id": False,
            "id": True,
            "fname": True,
            "lname": True,
            "username": True,
            "email": True,
        },
    )

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is no longer valid.")
    return user
