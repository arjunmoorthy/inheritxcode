"""Common API response schemas (aligned with doctor-api)."""
from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    """Standard success response with optional typed data."""
    success: bool = True
    message: str = ""
    data: Optional[Any] = None


class ErrorResponse(BaseModel):
    """Standard error response."""
    success: bool = False
    status_code: Optional[int] = 400
    message: str = ""
    details: Optional[Any] = None
