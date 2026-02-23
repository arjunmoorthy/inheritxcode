from pydantic.generics import GenericModel
from typing import Any, Optional
from typing import Generic, TypeVar, Optional

T = TypeVar("T")

class APIResponse(GenericModel,  Generic[T]):
    success: bool
    message: str
    data: Optional[Any] = None

class ErrorResponse(GenericModel):
    success: bool = False
    status_code: Optional[int] = 400
    message: str
    details: Optional[Any] = None