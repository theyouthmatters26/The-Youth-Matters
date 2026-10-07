"""Flask extension singletons. Initialised against the app in create_app()."""
from flask_cors import CORS
from flask_jwt_extended import JWTManager, get_jwt_identity, verify_jwt_in_request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cors = CORS()
socketio = SocketIO()
limiter = Limiter(key_func=get_remote_address)


def member_key():
    """Count a limit per signed-in member, not per address: on a phone network thousands of students
    share one address, and one student can change theirs."""
    verify_jwt_in_request(optional=True)
    return f"member:{get_jwt_identity() or get_remote_address()}"
