import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.engine import URL

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")  # one settings file for backend and website, at the project root

# Migrations live in the top-level database/ folder, not inside backend/.
MIGRATIONS_DIR = str(ROOT / "database" / "migrations")


def database_url():
    """Where PostgreSQL is. A full DATABASE_URL wins (a managed database hands you one). Otherwise it is
    put together from the DB_ settings; left blank, those describe the database docker-compose.yml starts."""
    if os.getenv("DATABASE_URL"):
        return os.getenv("DATABASE_URL")
    return URL.create("postgresql+psycopg", host=os.getenv("DB_HOST") or "localhost", port=int(os.getenv("DB_PORT") or 5432),
                      database=os.getenv("DB_NAME") or "tymdatabase", username=os.getenv("DB_USER") or "tym",
                      password=os.getenv("DB_PASSWORD") or "tym").render_as_string(hide_password=False)


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY") or "dev-only-secret-key-set-SECRET_KEY-in-production"
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or "dev-only-jwt-key-set-JWT_SECRET_KEY-in-production"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    SQLALCHEMY_DATABASE_URI = database_url()
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # Rate limits are counted in this process's memory: no Redis or other service to run
    RATELIMIT_STORAGE_URI = "memory://"
    # How many proxies sit in front of the API (Nginx = 1; Cloudflare in front of Nginx = 2). The visitor's
    # address is read from that many steps back in X-Forwarded-For; without it every visitor looks like the
    # proxy and shares one rate limit. 0 = the API is reached directly.
    TRUSTED_PROXIES = int(os.getenv("TRUSTED_PROXIES") or 1)
    CORS_ORIGINS = (os.getenv("CORS_ORIGINS") or "http://localhost:5173").split(",")

    SPACES_ENDPOINT = os.getenv("SPACES_ENDPOINT")
    SPACES_REGION = os.getenv("SPACES_REGION")
    SPACES_KEY = os.getenv("SPACES_KEY")
    SPACES_SECRET = os.getenv("SPACES_SECRET")
    SPACES_BUCKET = os.getenv("SPACES_BUCKET") or "tym-media"

    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    # Razorpay: test keys (rzp_test_...) work end to end without real money
    RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
    RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
    RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET")
    RESEND_API_KEY = os.getenv("RESEND_API_KEY")
    MAIL_FROM = os.getenv("MAIL_FROM") or "The Youth Matters <no-reply@theyouthmatters.com>"
    CONTACT_EMAIL = os.getenv("CONTACT_EMAIL") or "support@theyouthmatters.com"  # contact form and mentor applications

    # Admin panel: the owner's login. The password is only ever stored as a bcrypt hash.
    ADMIN_EMAIL = (os.getenv("ADMIN_EMAIL") or "").strip().lower()
    ADMIN_PASSWORD_HASH = (os.getenv("ADMIN_PASSWORD_HASH") or "").strip()
    # Public address of the website, for links in emails. Empty = the first address in CORS_ORIGINS.
    SITE_URL = (os.getenv("VITE_SITE_URL") or "").rstrip("/")

    # TYMAi (Ask TYM AI and @TYMAi in chat rooms). Without a key it answers from the community instead.
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
    AI_MODEL = os.getenv("AI_MODEL") or "claude-opus-5-5"

    # What a mentor keeps of what a counselling hour sells for. The rest covers the platform,
    # payment fees and support. Their wallet (api/mentors.py) works it out from this.
    MENTOR_SHARE_PERCENT = int(os.getenv("MENTOR_SHARE_PERCENT") or 70)

    MAX_CONTENT_LENGTH = 12 * 1024 * 1024  # photo ID uploads
    MIN_AGE = 18
    AI_FALLBACK_AFTER_HOURS = 6


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite://"
    SQLALCHEMY_ENGINE_OPTIONS = {}
    RATELIMIT_STORAGE_URI = "memory://"
    # Nothing outside this machine: a test run must not send email, call Claude or touch Razorpay,
    # whatever keys happen to be in .env. A test that wants one sets it itself.
    RESEND_API_KEY = None
    ANTHROPIC_API_KEY = None
    RAZORPAY_KEY_ID = RAZORPAY_KEY_SECRET = RAZORPAY_WEBHOOK_SECRET = None
