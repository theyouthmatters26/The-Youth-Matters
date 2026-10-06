import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")  # one settings file for backend and website, at the project root

# Migrations live in the top-level database/ folder, not inside backend/.
MIGRATIONS_DIR = str(ROOT / "database" / "migrations")


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY") or "dev-only-secret-key-set-SECRET_KEY-in-production"
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or "dev-only-jwt-key-set-JWT_SECRET_KEY-in-production"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL") or "postgresql+psycopg://tym:tym@localhost:5432/tym"
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    REDIS_URL = os.getenv("REDIS_URL") or "redis://localhost:6379/0"
    RATELIMIT_STORAGE_URI = os.getenv("REDIS_URL") or "memory://"
    CORS_ORIGINS = (os.getenv("CORS_ORIGINS") or "http://localhost:5173").split(",")

    SPACES_ENDPOINT = os.getenv("SPACES_ENDPOINT")
    SPACES_REGION = os.getenv("SPACES_REGION")
    SPACES_KEY = os.getenv("SPACES_KEY")
    SPACES_SECRET = os.getenv("SPACES_SECRET")
    SPACES_BUCKET = os.getenv("SPACES_BUCKET", "tym-media")

    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    # Razorpay: test keys (rzp_test_...) work end to end without real money
    RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
    RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
    RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET")
    RESEND_API_KEY = os.getenv("RESEND_API_KEY")
    MAIL_FROM = os.getenv("MAIL_FROM", "The Youth Matters <no-reply@theyouthmatters.org>")
    CONTACT_EMAIL = os.getenv("CONTACT_EMAIL") or "hello@theyouthmatters.org"  # contact form and mentor applications

    # TYMAi (Ask TYM AI and @TYMAi in chat rooms). Without a key it answers from the community instead.
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
    AI_MODEL = os.getenv("AI_MODEL") or "claude-opus-5-5"

    MAX_CONTENT_LENGTH = 12 * 1024 * 1024  # photo ID uploads
    MIN_AGE = 18
    AI_FALLBACK_AFTER_HOURS = 6


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite://"
    SQLALCHEMY_ENGINE_OPTIONS = {}
    RATELIMIT_STORAGE_URI = "memory://"
