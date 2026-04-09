import boto3
import uuid
from botocore.exceptions import ClientError
from urllib.parse import quote
from typing import Tuple

from core.config import settings


def _get_s3_client():
    """Create S3 client using credentials from .env (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)."""
    kwargs = {
        "region_name": settings.aws_region or "us-east-1",
    }
    if settings.aws_access_key_id:
        kwargs["aws_access_key_id"] = settings.aws_access_key_id
    if settings.aws_secret_access_key:
        kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
    return boto3.client("s3", **kwargs)


_s3_client = None


def _client():
    global _s3_client
    if _s3_client is None:
        _s3_client = _get_s3_client()
    return _s3_client


def upload_file_to_s3(file_bytes: bytes, original_filename: str) -> str:
    """
    Uploads file to S3 and returns file URL.
    Uses S3_BUCKET_NAME, AWS_REGION from .env via settings.
    """
    bucket = settings.s3_bucket_name

    region = settings.aws_region or "us-east-1"
    unique_filename = f"faxes/{uuid.uuid4()}_{original_filename}"

    try:
        _client().put_object(
            Bucket=bucket,
            Key=unique_filename,
            Body=file_bytes,
            ContentType="application/pdf"
        )
        # Use path-style S3 URL instead of virtual-host style.
        # Buckets containing dots (e.g. "oncolife.ai-fax-storage") can fail TLS
        # hostname validation with virtual-host URLs:
        #   https://<bucket>.s3.<region>.amazonaws.com/<key>
        # Path-style avoids that mismatch and is safer for third-party fetchers.
        encoded_key = quote(unique_filename, safe="/")
        file_url = f"https://s3.{region}.amazonaws.com/{bucket}/{encoded_key}"
        return file_url

    except ClientError as e:
        raise e


def upload_file_to_s3_with_presigned_url(
    file_bytes: bytes,
    original_filename: str,
    expires_in_seconds: int = 86400,
) -> Tuple[str, str]:
    """
    Upload PDF to S3 and return:
      1) object URL (non-signed)
      2) presigned GET URL (for external consumers like Sinch)
    """
    bucket = settings.s3_bucket_name
    unique_filename = f"faxes/{uuid.uuid4()}_{original_filename}"

    try:
        _client().put_object(
            Bucket=bucket,
            Key=unique_filename,
            Body=file_bytes,
            ContentType="application/pdf",
        )

        region = settings.aws_region or "us-east-1"
        encoded_key = quote(unique_filename, safe="/")
        object_url = f"https://s3.{region}.amazonaws.com/{bucket}/{encoded_key}"

        presigned_url = _client().generate_presigned_url(
            "get_object",
            Params={
                "Bucket": bucket,
                "Key": unique_filename,
                "ResponseContentType": "application/pdf",
            },
            ExpiresIn=expires_in_seconds,
        )
        return object_url, presigned_url
    except ClientError as e:
        raise e