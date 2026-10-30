import os
from threading import Lock

from pymongo import MongoClient, ReturnDocument
from pymongo.errors import PyMongoError

from config import load_backend_environment


_client: MongoClient | None = None
_client_uri: str | None = None
_client_lock = Lock()


def get_mongo_client() -> MongoClient:
    global _client, _client_uri

    load_backend_environment()
    uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/").strip()
    if not uri:
        raise RuntimeError("MONGODB_URI is empty. Set it in backend/.env.")

    with _client_lock:
        if _client is None or _client_uri != uri:
            if _client is not None:
                _client.close()
            client = MongoClient(uri, serverSelectionTimeoutMS=5000)
            try:
                client.admin.command("ping")
            except PyMongoError as error:
                client.close()
                _client = None
                _client_uri = None
                raise RuntimeError(
                    "Unable to connect to MongoDB. Check MONGODB_URI and confirm the server is reachable."
                ) from error
            _client = client
            _client_uri = uri

        return _client


def get_db():
    load_backend_environment()
    database_name = os.getenv("MONGODB_DB_NAME", "login_db").strip()
    if not database_name:
        raise RuntimeError("MONGODB_DB_NAME is empty. Set it in backend/.env.")
    return get_mongo_client()[database_name]


def next_id(database, sequence_name: str) -> int:
    counter = database.id_counters.find_one_and_update(
        {"_id": sequence_name},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return counter["value"]


def close_mongo_client() -> None:
    global _client, _client_uri

    with _client_lock:
        if _client is not None:
            _client.close()
        _client = None
        _client_uri = None
