import boto3
import time

from core.config import settings


def _get_textract_client():
    """Create Textract client using credentials from .env (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)."""
    kwargs = {
        "region_name": settings.aws_region or "us-east-1",
    }
    if settings.aws_access_key_id:
        kwargs["aws_access_key_id"] = settings.aws_access_key_id
    if settings.aws_secret_access_key:
        kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
    return boto3.client("textract", **kwargs)


textract_client = None


def _client():
    global textract_client
    if textract_client is None:
        textract_client = _get_textract_client()
    return textract_client


def run_textract_from_s3(bucket: str, key: str) -> str:
    client = _client()
    response = client.start_document_text_detection(
        DocumentLocation={
            "S3Object": {
                "Bucket": bucket,
                "Name": key
            }
        }
    )

    job_id = response["JobId"]

    # ---- Poll until job completes ----
    while True:
        result = client.get_document_text_detection(JobId=job_id)
        status = result["JobStatus"]

        if status == "SUCCEEDED":
            break
        if status == "FAILED":
            raise Exception("Textract failed")

        time.sleep(3)

    # ---- Fetch ALL pages ----
    extracted_data = []
    next_token = None

    while True:
        if next_token:
            result = client.get_document_text_detection(
                JobId=job_id,
                NextToken=next_token
            )
        else:
            result = client.get_document_text_detection(
                JobId=job_id
            )

        for block in result.get("Blocks", []):
            if block["BlockType"] == "LINE":
                extracted_data.append({
                    "text": block["Text"],
                    "confidence": block.get("Confidence", 0)
                })

        next_token = result.get("NextToken")
        if not next_token:
            break

    # ---- Average confidence ----
    if extracted_data:
        avg_confidence = sum(
            item["confidence"] for item in extracted_data
        ) / len(extracted_data)
    else:
        avg_confidence = 0

    full_text = "\n".join(item["text"] for item in extracted_data)

    return {
        "text": full_text,
        "avg_confidence": round(avg_confidence, 2),
        "lines": extracted_data
    }