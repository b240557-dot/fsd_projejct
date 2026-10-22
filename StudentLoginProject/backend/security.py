import os

from config import load_backend_environment


def ensure_session_secret() -> str:
    load_backend_environment()
    secret = os.getenv("SESSION_SECRET", "")
    if len(secret) < 32:
        raise RuntimeError("SESSION_SECRET must contain at least 32 characters. Set it in backend/.env.")
    return secret
