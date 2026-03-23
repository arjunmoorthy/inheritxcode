"""
Patient Questions Endpoints
===========================

API endpoints for "Questions to Ask Doctor" feature.

Endpoints:
- GET /questions: List patient's questions
- POST /questions: Create a new question
- PATCH /questions/{id}: Update a question (text, share status)
- DELETE /questions/{id}: Soft delete a question

Only the patient who created a question can modify or delete it.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from api.deps import get_patient_db, get_doctor_db, get_optional_patient_uuid
# token parsing is handled via api.deps.get_optional_patient_uuid
from db.doctor_models import DoctorUser, DoctorPatient
from db.models.questions import PatientQuestion
from core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class QuestionCreate(BaseModel):
    """Request model for creating a question."""
    question_text: str = Field(..., min_length=1, max_length=2000)
    share_with_physician: bool = False
    category: Optional[str] = Field(default="other", pattern="^(symptom|medication|treatment|other)$")


class QuestionUpdate(BaseModel):
    """Request model for updating a question."""
    question_text: Optional[str] = Field(None, min_length=1, max_length=2000)
    share_with_physician: Optional[bool] = None
    category: Optional[str] = Field(None, pattern="^(symptom|medication|treatment|other)$")
    is_answered: Optional[bool] = None


class QuestionResponse(BaseModel):
    """Response model for a question."""
    id: str
    patient_uuid: str
    question_text: str
    share_with_physician: bool
    is_answered: bool
    category: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]

    class Config:
        from_attributes = True


class QuestionListResponse(BaseModel):
    """Response model for listing questions."""
    questions: List[QuestionResponse]
    total: int


# =============================================================================
# Endpoints
# =============================================================================

@router.get(
    "",
    response_model=QuestionListResponse,
    summary="List Questions",
    description="Get all questions for the authenticated patient.",
)
async def list_questions(
    shared_only: bool = Query(False, description="Only return shared questions"),
    include_answered: bool = Query(True, description="Include answered questions"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_patient_db),
    doctor_db: Session = Depends(get_doctor_db),
    auth_uuid: Optional[UUID] = Depends(get_optional_patient_uuid),
):
    """
    List questions for the authenticated patient.
    
    By default returns all questions (private and shared).
    Use `shared_only=true` to filter to only shared questions.
    """
    if auth_uuid is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    patient_uuid = auth_uuid
    # Verify the user exists in doctor DB
    doctor_user = doctor_db.query(DoctorUser).filter(DoctorUser.uuid == patient_uuid).first()
    if not doctor_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found in doctor system")
    logger.info(f"Listing questions for patient {patient_uuid}")
    
    query = db.query(PatientQuestion).filter(
        PatientQuestion.patient_uuid == patient_uuid,
        PatientQuestion.is_deleted.is_(False),
    )
    
    if shared_only:
        query = query.filter(PatientQuestion.share_with_physician.is_(True))
    
    if not include_answered:
        query = query.filter(PatientQuestion.is_answered.is_(False))
    
    total = query.count()
    questions = query.order_by(desc(PatientQuestion.created_at)).limit(limit).all()
    
    return QuestionListResponse(
        questions=[
            QuestionResponse(
                id=str(q.id),
                patient_uuid=str(q.patient_uuid),
                question_text=q.question_text,
                share_with_physician=q.share_with_physician,
                is_answered=q.is_answered,
                category=q.category,
                created_at=q.created_at.isoformat() if q.created_at else None,
                updated_at=q.updated_at.isoformat() if q.updated_at else None,
            )
            for q in questions
        ],
        total=total,
    )


@router.post(
    "",
    response_model=QuestionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Question",
    description="Create a new question to ask the doctor.",
)
async def create_question(
    question_data: QuestionCreate,
    db: Session = Depends(get_patient_db),
    doctor_db: Session = Depends(get_doctor_db),
    auth_uuid: Optional[UUID] = Depends(get_optional_patient_uuid),
):
    """
    Create a new question.
    
    Questions are private by default. Set `share_with_physician=true`
    to make the question visible in the doctor portal.
    """
    # Require a valid Bearer token that decodes to a user UUID
    if auth_uuid is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    patient_uuid = auth_uuid
    # Verify the token maps to a doctor-api user and that a fax_patient exists
    doctor_user = doctor_db.query(DoctorUser).filter(DoctorUser.uuid == patient_uuid).first()
    if not doctor_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found in doctor system")

    fax_patient = doctor_db.query(DoctorPatient).filter(DoctorPatient.user_id == doctor_user.id).first()
    if not fax_patient:
        # The user exists but is not registered as a fax_patient; treat as not found for question creation
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient record not found in doctor system")
    logger.info(f"Creating question for patient {patient_uuid}")
    
    question = PatientQuestion(
        patient_uuid=patient_uuid,
        question_text=question_data.question_text,
        share_with_physician=question_data.share_with_physician,
        category=question_data.category,
    )
    
    db.add(question)
    db.commit()
    db.refresh(question)
    
    logger.info(f"Created question {question.id} for patient {patient_uuid}")
    
    return QuestionResponse(
        id=str(question.id),
        patient_uuid=str(question.patient_uuid),
        question_text=question.question_text,
        share_with_physician=question.share_with_physician,
        is_answered=question.is_answered,
        category=question.category,
        created_at=question.created_at.isoformat() if question.created_at else None,
        updated_at=question.updated_at.isoformat() if question.updated_at else None,
    )


@router.patch(
    "/{question_id}",
    response_model=QuestionResponse,
    summary="Update Question",
    description="Update a question's text or sharing status.",
)
async def update_question(
    question_id: UUID,
    question_data: QuestionUpdate,
    db: Session = Depends(get_patient_db),
    doctor_db: Session = Depends(get_doctor_db),
    auth_uuid: Optional[UUID] = Depends(get_optional_patient_uuid),
):
    """
    Update a question.
    
    Can update the question text, category, sharing status, or mark as answered.
    Only the patient who created the question can update it.
    """
    if auth_uuid is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    patient_uuid = auth_uuid
    doctor_user = doctor_db.query(DoctorUser).filter(DoctorUser.uuid == patient_uuid).first()
    if not doctor_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found in doctor system")
    logger.info(f"Updating question {question_id} for patient {patient_uuid}")
    
    question = db.query(PatientQuestion).filter(
        PatientQuestion.id == question_id,
        PatientQuestion.patient_uuid == patient_uuid,
        PatientQuestion.is_deleted.is_(False),
    ).first()
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )
    
    # Update fields if provided
    if question_data.question_text is not None:
        question.question_text = question_data.question_text
    if question_data.share_with_physician is not None:
        question.share_with_physician = question_data.share_with_physician
    if question_data.category is not None:
        question.category = question_data.category
    if question_data.is_answered is not None:
        question.is_answered = question_data.is_answered
    
    db.commit()
    db.refresh(question)
    
    logger.info(f"Updated question {question_id}")
    
    return QuestionResponse(
        id=str(question.id),
        patient_uuid=str(question.patient_uuid),
        question_text=question.question_text,
        share_with_physician=question.share_with_physician,
        is_answered=question.is_answered,
        category=question.category,
        created_at=question.created_at.isoformat() if question.created_at else None,
        updated_at=question.updated_at.isoformat() if question.updated_at else None,
    )


@router.delete(
    "/{question_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Question",
    description="Soft delete a question.",
)
async def delete_question(
    question_id: UUID,
    db: Session = Depends(get_patient_db),
    doctor_db: Session = Depends(get_doctor_db),
    auth_uuid: Optional[UUID] = Depends(get_optional_patient_uuid),
):
    """
    Delete a question (soft delete).
    
    Only the patient who created the question can delete it.
    """
    if auth_uuid is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    patient_uuid = auth_uuid
    doctor_user = doctor_db.query(DoctorUser).filter(DoctorUser.uuid == patient_uuid).first()
    if not doctor_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found in doctor system")
    logger.info(f"Deleting question {question_id} for patient {patient_uuid}")
    
    question = db.query(PatientQuestion).filter(
        PatientQuestion.id == question_id,
        PatientQuestion.patient_uuid == patient_uuid,
        PatientQuestion.is_deleted.is_(False),
    ).first()
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )
    
    question.is_deleted = True
    db.commit()
    
    logger.info(f"Deleted question {question_id}")
    
    return None


@router.post(
    "/{question_id}/share",
    response_model=QuestionResponse,
    summary="Share Question with Doctor",
    description="Toggle sharing a question with the doctor.",
)
async def toggle_share_question(
    question_id: UUID,
    share: bool = Query(..., description="True to share, False to unshare"),
    db: Session = Depends(get_patient_db),
    doctor_db: Session = Depends(get_doctor_db),
    auth_uuid: Optional[UUID] = Depends(get_optional_patient_uuid),
):
    """
    Toggle whether a question is shared with the physician.
    
    This is a convenience endpoint for quickly changing the share status.
    """
    if auth_uuid is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    patient_uuid = auth_uuid
    doctor_user = doctor_db.query(DoctorUser).filter(DoctorUser.uuid == patient_uuid).first()
    if not doctor_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found in doctor system")
    logger.info(f"Toggling share for question {question_id} to {share}")
    
    question = db.query(PatientQuestion).filter(
        PatientQuestion.id == question_id,
        PatientQuestion.patient_uuid == patient_uuid,
        PatientQuestion.is_deleted.is_(False),
    ).first()
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )
    
    question.share_with_physician = share
    db.commit()
    db.refresh(question)
    
    logger.info(f"Question {question_id} share status: {share}")
    
    return QuestionResponse(
        id=str(question.id),
        patient_uuid=str(question.patient_uuid),
        question_text=question.question_text,
        share_with_physician=question.share_with_physician,
        is_answered=question.is_answered,
        category=question.category,
        created_at=question.created_at.isoformat() if question.created_at else None,
        updated_at=question.updated_at.isoformat() if question.updated_at else None,
    )



