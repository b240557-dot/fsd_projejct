import os

import mysql.connector

from config import load_backend_environment


def get_db():
    load_backend_environment()
    password = os.getenv("DB_PASSWORD")
    if password is None:
        raise RuntimeError("DB_PASSWORD is missing. Set it in backend/.env.")

    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "root"),
        password=password,
        database=os.getenv("DB_NAME", "login_db"),
        connection_timeout=5,
    )
