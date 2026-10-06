from datetime import datetime, timezone

from ..extensions import db


def utcnow():
    return datetime.now(timezone.utc)


def enum(*values, name):
    """String enum stored as VARCHAR + CHECK constraint (easier to migrate than native PG enums)."""
    return db.Enum(*values, name=name, native_enum=False, create_constraint=True, length=32)


class Model(db.Model):
    __abstract__ = True

    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
