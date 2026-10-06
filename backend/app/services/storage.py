"""DigitalOcean Spaces (S3 API). Everything is private; reads go through short-lived signed URLs.

Without Spaces credentials (local development) files go to backend/instance/private instead.
"""
import uuid
from pathlib import Path

import boto3
from flask import current_app


def _client():
    cfg = current_app.config
    return boto3.client(
        "s3",
        endpoint_url=cfg["SPACES_ENDPOINT"],
        region_name=cfg["SPACES_REGION"],
        aws_access_key_id=cfg["SPACES_KEY"],
        aws_secret_access_key=cfg["SPACES_SECRET"],
    )


def _local_path(key):
    if current_app.config["SPACES_KEY"]:
        return None
    return Path(current_app.instance_path, "private", key)


def upload(data: bytes, folder: str, content_type: str) -> str:
    """Store bytes and return the storage key, e.g. 'identity/3f2a....jpeg'."""
    key = f"{folder}/{uuid.uuid4().hex}.{content_type.split('/')[-1]}"
    if path := _local_path(key):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key
    _client().put_object(Bucket=current_app.config["SPACES_BUCKET"], Key=key, Body=data,
                         ContentType=content_type, ACL="private")
    return key


def delete(key: str | None) -> None:
    if not key:
        return
    if path := _local_path(key):
        path.unlink(missing_ok=True)
        return
    _client().delete_object(Bucket=current_app.config["SPACES_BUCKET"], Key=key)


def signed_url(key: str, expires: int = 300) -> str:
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": current_app.config["SPACES_BUCKET"], "Key": key},
        ExpiresIn=expires,
    )
