from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import bcrypt

from database import get_db


app = FastAPI()


# =========================
# CORS
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)


# =========================
# SIGNUP MODEL
# =========================

class SignupData(BaseModel):

    fname: str
    lname: str
    username: str
    password: str
    email: str
    contact: str


# =========================
# LOGIN MODEL
# =========================

class LoginData(BaseModel):

    username: str
    password: str


# =========================
# HOME / TEST API
# =========================

@app.get("/")
def home():

    return {
        "message": "FastAPI server is running"
    }


# =========================
# SIGNUP API
# =========================

@app.post("/signup")
def signup(data: SignupData):

    db = get_db()
    cursor = db.cursor()

    try:

        # Check username

        cursor.execute(
            "SELECT id FROM users WHERE username = %s",
            (data.username,)
        )

        existing_user = cursor.fetchone()

        if existing_user:

            return {
                "success": False,
                "message": "Username already exists"
            }


        # Check email

        cursor.execute(
            "SELECT id FROM users WHERE email = %s",
            (data.email,)
        )

        existing_email = cursor.fetchone()

        if existing_email:

            return {
                "success": False,
                "message": "Email already exists"
            }


        # Password hashing

        hashed_password = bcrypt.hashpw(
            data.password.encode("utf-8"),
            bcrypt.gensalt()
        )


        # Insert user

        query = """
            INSERT INTO users
            (fname, lname, username, password, email, contact)
            VALUES (%s, %s, %s, %s, %s, %s)
        """


        values = (
            data.fname,
            data.lname,
            data.username,
            hashed_password.decode("utf-8"),
            data.email,
            data.contact
        )


        cursor.execute(query, values)

        db.commit()


        return {
            "success": True,
            "message": "Registration successful"
        }


    finally:

        cursor.close()
        db.close()


# =========================
# LOGIN API
# =========================

@app.post("/login")
def login(data: LoginData):

    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:

        # Find user

        query = """
            SELECT *
            FROM users
            WHERE username = %s
        """


        cursor.execute(
            query,
            (data.username,)
        )


        user = cursor.fetchone()


        # User not found

        if not user:

            return {
                "success": False,
                "message": "Invalid username or password"
            }


        # Check password

        password_match = bcrypt.checkpw(
            data.password.encode("utf-8"),
            user["password"].encode("utf-8")
        )


        if password_match:

            return {
                "success": True,
                "message": "Login successful",
                "username": user["username"]
            }


        return {
            "success": False,
            "message": "Invalid username or password"
        }


    finally:

        cursor.close()
        db.close()