from flask import Flask, abort, jsonify
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix

from .config import MIGRATIONS_DIR, Config
from .extensions import cors, db, jwt, limiter, migrate, socketio


def create_app(config=Config):
    app = Flask(__name__)
    app.config.from_object(config)
    if app.config["TRUSTED_PROXIES"]:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=app.config["TRUSTED_PROXIES"])

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

    @app.before_request
    def real_keys_on_a_real_site():
        """Outside development the signing keys must be set: with the built-in ones anybody could
        forge a sign-in, the owner's included."""
        if not (app.debug or app.testing) and "dev-only" in app.config["SECRET_KEY"] + app.config["JWT_SECRET_KEY"]:
            app.logger.error("SECRET_KEY and JWT_SECRET_KEY are not set in .env. Refusing to serve requests.")
            abort(503, "This server is not set up yet: SECRET_KEY and JWT_SECRET_KEY are missing.")

    friendly = {
        413: "That photo is too large. Use one under 12 MB.",
        429: "Too many attempts. Wait a few minutes, then try again.",
    }

    @app.errorhandler(HTTPException)
    def http_error(err):
        return jsonify(error=err.name, message=friendly.get(err.code, err.description)), err.code

    return app
