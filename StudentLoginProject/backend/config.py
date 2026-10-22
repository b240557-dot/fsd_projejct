import os
from pathlib import Path

from dotenv import dotenv_values, load_dotenv


BACKEND_ENV_PATH = Path(__file__).resolve().with_name(".env")


def load_backend_environment() -> None:
    load_dotenv(BACKEND_ENV_PATH)
    for name, value in dotenv_values(BACKEND_ENV_PATH).items():
        if value is not None and not os.getenv(name, "").strip():
            os.environ[name] = value


load_backend_environment()
