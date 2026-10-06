from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

from .config import MIGRATIONS_DIR, Config
from .extensions import cors, db, jwt, limiter, migrate, socketio


def create_app(config=Config):
    app = Flask(__name__)
    app.config.from_object(config)

    db.init_app(app)
    migrate.init_app(app, db, directory=MIGRATIONS_DIR)
    jwt.init_app(app)
    limiter.init_app(app)
    cors.init_app(app, origins=app.config["CORS_ORIGINS"], supports_credentials=True)
    socketio.init_app(app, cors_allowed_origins=app.config["CORS_ORIGINS"])

    from . import models  # noqa: F401  register models with SQLAlchemy metadata
    from . import sockets  # noqa: F401  register SocketIO event handlers
    from .api import register_blueprints

    register_blueprints(app)

    friendly = {
        413: "That photo is too large. Use one under 12 MB.",
        429: "Too many attempts. Wait a few minutes, then try again.",
    }

    @app.errorhandler(HTTPException)
    def http_error(err):
        return jsonify(error=err.name, message=friendly.get(err.code, err.description)), err.code

    return app
