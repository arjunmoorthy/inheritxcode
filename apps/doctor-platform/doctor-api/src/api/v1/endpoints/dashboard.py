# """
# ================================================================================
# Dashboard Endpoints - Doctor API
# ================================================================================

# Module:         dashboard.py
# Description:    REST API endpoints for the clinical monitoring dashboard.
#                 Provides patient ranking, symptom timelines, and weekly reports.

# Created:        2025-12-25
# Modified:       2026-01-16
# Author:         Naveen Babu S A
# Version:        2.1.0

# Endpoints:
#     GET  /dashboard                          - Landing view with ranked patients
#     GET  /dashboard/patient/{uuid}           - Patient detail with timeline
#     GET  /dashboard/patient/{uuid}/questions - Patient's shared questions
#     GET  /dashboard/reports                  - List weekly reports
#     GET  /dashboard/reports/weekly           - Get/generate weekly report
#     POST /dashboard/reports/generate         - Trigger report generation

# Security:
#     - All endpoints require authentication
#     - Physician-scoped data access
#     - Staff access via associated physicians
#     - Audit logging on all patient data access

# Copyright:
#     (c) 2026 OncoLife Health Technologies. All rights reserved.
# ================================================================================
# """

from typing import List, Optional
from uuid import UUID
from datetime import date, datetime

from fastapi import APIRouter, Depends, Query, HTTPException, status, Request
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy.orm import Session

from api.deps import get_current_user, get_patient_db_session, get_doctor_db_session, TokenData
from services.dashboard_service import DashboardService
from services.fax_patient_service import parse_date
from services.audit_service import AuditService
from core.logging import get_logger
from core.exceptions import NotFoundError, AuthorizationError
from core.schemas import APIResponse
from db.models.fax_models import Patient as FaxPatient
from db.models.user import User
from sqlalchemy import or_, and_, text
from api.deps import require_roles
from datetime import time, timedelta
from typing import Dict, Any, Literal, Optional
from db.models.staff import PhysicianNurseAssignment, PhysicianPatient, Staff


logger = get_logger(__name__)

router = APIRouter()


# # =============================================================================
# # Response Models
# # =============================================================================

# class PatientRankingSummary(BaseModel):
#     """Summary of a patient for the dashboard ranking."""
#     patient_uuid: str
#     first_name: Optional[str]
#     last_name: Optional[str]
#     email_address: Optional[str]
#     last_checkin: Optional[str]
#     max_severity: Optional[str]
#     has_escalation: bool
#     severity_badge: str

#     class Config:
#         from_attributes = True


# class DashboardLandingResponse(BaseModel):
#     """Response for dashboard landing view."""
#     patients: List[PatientRankingSummary]
#     total_patients: int
#     period_days: int


# class SymptomDataPoint(BaseModel):
#     """A single data point in the symptom timeline."""
#     date: Optional[str]
#     severity: str
#     severity_numeric: int


# class TreatmentEventResponse(BaseModel):
#     """A treatment event for timeline overlay."""
#     event_type: str
#     event_date: Optional[str]
#     metadata: dict = {}


# class PatientTimelineResponse(BaseModel):
#     """Response for patient symptom timeline."""
#     patient_uuid: str
#     period_days: int
#     symptom_series: dict  # symptom_id -> list of data points
#     treatment_events: List[TreatmentEventResponse]


# class SharedQuestionResponse(BaseModel):
#     """A shared patient question."""
#     id: str
#     question_text: str
#     category: Optional[str]
#     is_answered: bool
#     created_at: Optional[str]


# class WeeklyReportSummary(BaseModel):
#     """Summary of a weekly report."""
#     report_id: Optional[str]
#     physician_id: str
#     report_week_start: str
#     report_week_end: str
#     generated_at: str
#     patient_count: int
#     total_alerts: int
#     total_questions: int


# class PatientReportSection(BaseModel):
#     """Patient section in weekly report."""
#     patient: dict
#     symptoms: dict
#     alerts: List[dict]
#     questions: List[dict]


# class WeeklyReportDataResponse(BaseModel):
#     """Full weekly report data."""
#     physician_id: str
#     report_week_start: str
#     report_week_end: str
#     generated_at: str
#     patient_count: int
#     total_alerts: int
#     total_questions: int
#     patients: List[PatientReportSection]


# # =============================================================================
# # Dashboard Landing
# # =============================================================================

# @router.get(
#     "",
#     response_model=DashboardLandingResponse,
#     summary="Dashboard Landing",
#     description="Get ranked list of patients requiring attention.",
# )
# async def get_dashboard_landing(
#     days: int = Query(7, ge=1, le=90, description="Days to look back"),
#     limit: int = Query(50, ge=1, le=200, description="Maximum patients"),
#     request: Request = None,
#     current_user: TokenData = Depends(get_current_user),
#     patient_db: Session = Depends(get_patient_db_session),
#     doctor_db: Session = Depends(get_doctor_db_session),
# ):
#     """
#     Get the dashboard landing view with ranked patients.
    
#     Patients are ranked by:
#     1. Has urgent escalation (highest priority)
#     2. Maximum symptom severity
#     3. Most recent activity
    
#     This answers: "Which patients need attention right now?"
#     """
#     logger.info(f"Dashboard landing for user {current_user.sub}")
    
#     dashboard_service = DashboardService(patient_db, doctor_db)
    
#     try:
#         patients = dashboard_service.get_ranked_patient_list(
#             physician_id=UUID(current_user.sub),
#             days=days,
#             limit=limit,
#         )
        
#         # Log the dashboard access for audit
#         audit_service = AuditService(doctor_db)
#         audit_service.log_action(
#             user_id=UUID(current_user.sub),
#             user_role="physician",
#             action="view_dashboard",
#             entity_type="dashboard",
#             ip_address=request.client.host if request else None,
#         )
        
#         return DashboardLandingResponse(
#             patients=[PatientRankingSummary(**p) for p in patients],
#             total_patients=len(patients),
#             period_days=days,
#         )
#     except Exception as e:
#         logger.error(f"Error getting dashboard: {e}")
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail="Failed to load dashboard",
#         )


# # =============================================================================
# # Patient Detail View
# # =============================================================================

# @router.get(
#     "/patient/{patient_uuid}",
#     response_model=PatientTimelineResponse,
#     summary="Patient Symptom Timeline",
#     description="Get symptom timeline for a specific patient.",
# )
# async def get_patient_timeline(
#     patient_uuid: UUID,
#     days: int = Query(30, ge=1, le=365, description="Days to look back"),
#     request: Request = None,
#     current_user: TokenData = Depends(get_current_user),
#     patient_db: Session = Depends(get_patient_db_session),
#     doctor_db: Session = Depends(get_doctor_db_session),
# ):
#     """
#     Get symptom timeline data for a patient.
    
#     Returns data for multi-line time series chart:
#     - Each symptom type = one line
#     - Severity mapped to numeric scale (1=mild, 4=urgent)
#     - Treatment events as vertical reference lines
#     """
#     logger.info(f"Getting timeline for patient {patient_uuid}")
    
#     dashboard_service = DashboardService(patient_db, doctor_db)
    
#     try:
#         timeline = dashboard_service.get_patient_symptom_timeline(
#             patient_uuid=patient_uuid,
#             physician_id=UUID(current_user.sub),
#             days=days,
#         )
        
#         # Log access
#         audit_service = AuditService(doctor_db)
#         audit_service.log_action(
#             user_id=UUID(current_user.sub),
#             user_role="physician",
#             action="view_patient_timeline",
#             entity_type="patient",
#             entity_id=patient_uuid,
#             ip_address=request.client.host if request else None,
#         )
        
#         return PatientTimelineResponse(
#             patient_uuid=timeline["patient_uuid"],
#             period_days=timeline["period_days"],
#             symptom_series=timeline["symptom_series"],
#             treatment_events=[
#                 TreatmentEventResponse(**e) for e in timeline["treatment_events"]
#             ],
#         )
#     except AuthorizationError as e:
#         raise HTTPException(
#             status_code=status.HTTP_403_FORBIDDEN,
#             detail=str(e),
#         )
#     except Exception as e:
#         logger.error(f"Error getting patient timeline: {e}")
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail="Failed to load patient timeline",
#         )


# # =============================================================================
# # Patient Questions
# # =============================================================================

# @router.get(
#     "/patient/{patient_uuid}/questions",
#     response_model=List[SharedQuestionResponse],
#     summary="Patient Shared Questions",
#     description="Get questions shared by the patient.",
# )
# async def get_patient_questions(
#     patient_uuid: UUID,
#     limit: int = Query(50, ge=1, le=200),
#     current_user: TokenData = Depends(get_current_user),
#     patient_db: Session = Depends(get_patient_db_session),
#     doctor_db: Session = Depends(get_doctor_db_session),
# ):
#     """
#     Get questions the patient has chosen to share with their physician.
    
#     Only returns questions where share_with_physician = true.
#     Private questions are never visible to physicians.
#     """
#     logger.info(f"Getting shared questions for patient {patient_uuid}")
    
#     dashboard_service = DashboardService(patient_db, doctor_db)
    
#     try:
#         questions = dashboard_service.get_patient_shared_questions(
#             patient_uuid=patient_uuid,
#             physician_id=UUID(current_user.sub),
#             limit=limit,
#         )
        
#         return [SharedQuestionResponse(**q) for q in questions]
#     except AuthorizationError as e:
#         raise HTTPException(
#             status_code=status.HTTP_403_FORBIDDEN,
#             detail=str(e),
#         )


# # =============================================================================
# # Weekly Reports
# # =============================================================================

# @router.get(
#     "/reports/weekly",
#     response_model=WeeklyReportDataResponse,
#     summary="Get Weekly Report Data",
#     description="Get data for the weekly physician report.",
# )
# async def get_weekly_report(
#     week_start: Optional[date] = Query(None, description="Report week start (default: last Monday)"),
#     current_user: TokenData = Depends(get_current_user),
#     patient_db: Session = Depends(get_patient_db_session),
#     doctor_db: Session = Depends(get_doctor_db_session),
# ):
#     """
#     Get data for a weekly physician report.
    
#     Includes:
#     - Patient demographics
#     - Weekly symptom severity trends
#     - Escalation events
#     - Shared questions
#     - Treatment overlays
#     """
#     logger.info(f"Getting weekly report for physician {current_user.sub}")
    
#     dashboard_service = DashboardService(patient_db, doctor_db)
    
#     try:
#         report_data = dashboard_service.get_weekly_report_data(
#             physician_id=UUID(current_user.sub),
#             week_start=week_start,
#         )
        
#         return WeeklyReportDataResponse(
#             physician_id=report_data["physician_id"],
#             report_week_start=report_data["report_week_start"],
#             report_week_end=report_data["report_week_end"],
#             generated_at=report_data["generated_at"],
#             patient_count=report_data["patient_count"],
#             total_alerts=report_data["total_alerts"],
#             total_questions=report_data["total_questions"],
#             patients=[
#                 PatientReportSection(
#                     patient=p["patient"],
#                     symptoms=p["symptoms"],
#                     alerts=p["alerts"],
#                     questions=p["questions"],
#                 )
#                 for p in report_data["patients"]
#             ],
#         )
#     except Exception as e:
#         logger.error(f"Error generating weekly report: {e}")
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail="Failed to generate weekly report",
#         )


@router.get("/patient-listing-dashboard")
def patient_listing_dashboard(
    search: str | None = Query(
        default=None,
        description="Search by first name, last name, or full name"
    ),
    physician_ids: list[str] | None = Query(
        default=None,
        description="Filter by one or more physician IDs (repeat param or comma-separated)",
    ),
    current_user: TokenData = Depends(require_roles("physician", "nurse", "admin")),
    db: Session = Depends(get_doctor_db_session),
    patient_db: Session = Depends(get_patient_db_session),
):
    try:
        # query = (
        #     db.query(FaxPatient)
        #     .join(
        #         PhysicianPatient,
        #         PhysicianPatient.patient_id == FaxPatient.id
        #     )
        # )

        query = db.query(FaxPatient)

        staff = db.query(Staff).filter(
            Staff.user_id == current_user.id
        ).first()

        if not staff and current_user.role != "admin":
            raise HTTPException(
                status_code=404,
                detail="Staff not found"
            )

        # Resolve role-based allowed physician ids first.
        allowed_physician_ids: Optional[list[int]]
        if current_user.role == "physician":
            allowed_physician_ids = [staff.id]
        elif current_user.role == "nurse":
            nurse_physician_ids = db.query(
                PhysicianNurseAssignment.physician_id
            ).filter(
                PhysicianNurseAssignment.nurse_id == staff.id
            ).all()
            allowed_physician_ids = [p[0] for p in nurse_physician_ids]
            if not allowed_physician_ids:
                return {"status": "success", "count": 0, "data": []}
        elif current_user.role == "admin":
            allowed_physician_ids = None
        else:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to view patients"
            )

        requested_physician_ids: list[int] = []
        if physician_ids:
            for raw in physician_ids:
                if raw is None:
                    continue
                for token in str(raw).split(","):
                    token = token.strip()
                    if not token:
                        continue
                    if not token.isdigit():
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"Invalid physician id: {token}",
                        )
                    requested_physician_ids.append(int(token))

        # remove duplicates
        if requested_physician_ids:
            requested_physician_ids = list(dict.fromkeys(requested_physician_ids))

        # ✅ FINAL LOGIC (Always assign)
        if requested_physician_ids:
            # override
            effective_physician_ids = requested_physician_ids
        else:
            # fallback
            effective_physician_ids = allowed_physician_ids

        if effective_physician_ids is not None:
            if not effective_physician_ids:
                return {"status": "success", "count": 0, "data": []}
            query = query.join(
                PhysicianPatient,
                PhysicianPatient.patient_id == FaxPatient.id
            ).filter(
                PhysicianPatient.physician_id.in_(effective_physician_ids)
            ).distinct()

        if search:
            terms = search.strip().split()

            if len(terms) == 1:
                # 🔹 Single word → first OR last name
                term = f"%{terms[0]}%"
                query = query.filter(
                    or_(
                        FaxPatient.first_name.ilike(term),
                        FaxPatient.last_name.ilike(term),
                    )
                )

            else:
                # 🔹 Multiple words → first_name AND last_name
                first = f"%{terms[0]}%"
                last = f"%{terms[-1]}%"
                query = query.filter(
                    and_(
                        FaxPatient.first_name.ilike(first),
                        FaxPatient.last_name.ilike(last),
                    )
                )

        patients = (
            query
            .order_by(FaxPatient.created_at.desc())
            .all()
        )

        patient_uuids = [
            str(p.user.uuid)
            for p in patients
            if getattr(p, "user", None) and getattr(p.user, "uuid", None)
        ]
        latest_chemo_by_patient: Dict[str, Optional[str]] = {}
        if patient_uuids:
            chemo_rows = patient_db.execute(
                text(
                    """
                    SELECT c.patient_uuid::text AS patient_uuid, MAX((c.engine_state->>'last_chemo_date')::date) AS last_chemo_date
                    FROM conversations c
                    WHERE c.patient_uuid::text = ANY(:patient_uuids)
                      AND c.engine_state->>'last_chemo_date' IS NOT NULL
                      AND c.engine_state->>'last_chemo_date' != ''
                    GROUP BY c.patient_uuid::text
                    """
                ),
                {"patient_uuids": patient_uuids},
            ).mappings().all()
            latest_chemo_by_patient = {
                row["patient_uuid"]: (
                    row["last_chemo_date"].isoformat()
                    if row.get("last_chemo_date") is not None
                    else None
                )
                for row in chemo_rows
            }

        response = []
        for p in patients:
            patient_uuid = (
                str(p.user.uuid)
                if getattr(p, "user", None) and getattr(p.user, "uuid", None)
                else None
            )

            # Resolve assigned oncologist(s) from active physician-patient assignments.
            assigned_oncologist_names = []
            for assignment in getattr(p, "physician_assignments", []) or []:
                if not getattr(assignment, "is_active", False):
                    continue
                physician = getattr(assignment, "physician", None)
                if physician is None:
                    continue
                physician_name = (getattr(physician, "full_name", "") or "").strip()
                if physician_name and physician_name not in assigned_oncologist_names:
                    assigned_oncologist_names.append(physician_name)

            response.append(
                {
                    "patient_id": p.id,
                    # UUID used by dashboard trends endpoint: /dashboard/patient/{patient_uuid}/trends
                    "patient_uuid": patient_uuid,
                    "last_chemo_date": latest_chemo_by_patient.get(patient_uuid) if patient_uuid else None,
                    "first_name": p.first_name,
                    "last_name": p.last_name,
                    "gender": p.gender,
                    "date_of_birth": p.date_of_birth,
                    "age": p.age,
                    "phone_number": p.phone_number,
                    "email": p.email,
                    "mrn": p.mrn,
                    "plan_name": p.plan_name,
                    "start_date": p.start_date,
                    "end_date": p.end_date,
                    "created_at": p.created_at,
                    # Requested fields
                    "diagnosis": p.diagnosis,
                    "location": p.location,
                    "assigned_oncologist": ", ".join(assigned_oncologist_names) if assigned_oncologist_names else p.oncologist,
                    "day_of_chemotherapy_treatment": p.chemotherapy_day,
                    "next_chemotherapy_treatment": p.next_chemotherapy_at,
                    "past_medical_history": p.past_medical_history,
                    "past_surgical_history": p.past_surgical_history,
                }
            )

        return {
            "status": "success",
            "count": len(response),
            "data": response,
        }

    except Exception as e:
        logger.error(f"Error fetching patient listing: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch patient listing",
        )




# =============================================================================
# Patient Dashboard Trends (Severity + Temperature + Medications)
# =============================================================================

SeverityLabel = Literal["mild", "moderate", "severe", "urgent", "none"]


def _symptom_name(symptom_id: str) -> str:
    symptom_map = {
        "FEV-202": "Fever",
        "COU-215": "Cough",
        "NAU-203": "Nausea",
        "VOM-204": "Vomiting",
        "CON-210": "Constipation",
        "DIA-205": "Diarrhea",
        "ABD-211": "Abdominal Pain",
        "PAI-213": "Pain / General Aches",
        "FAT-206": "Fatigue / Weakness",
        "NEU-216": "Neuropathy",
    }
    return symptom_map.get(symptom_id, symptom_id)


def _severity_from_detail(row: Dict[str, Any]) -> SeverityLabel:
    def _normalize(value: Any) -> Optional[SeverityLabel]:
        if not isinstance(value, str):
            return None
        v = value.strip().lower()
        mapping = {
            "mild": "mild",
            "mod": "moderate",
            "moderate": "moderate",
            "sev": "severe",
            "severe": "severe",
            "urgent": "urgent",
            "none": "none",
        }
        return mapping.get(v)  # type: ignore[return-value]

    severity_val = row.get("severity")
    triage_level = row.get("triage_level")
    sev = _normalize(severity_val)
    if sev:
        return sev

    # Fallback to symptom answer payload when normalized severity was not persisted.
    answers = row.get("answers_json") if isinstance(row.get("answers_json"), dict) else {}
    # Explicit abdominal pain severity should be visible in trends.
    sev = _normalize(answers.get("abd_pain_sev"))
    if sev:
        return sev
    # APP-209 / CON-210 use discomfort as the severity-like input.
    sev = _normalize(answers.get("discomfort"))
    if sev:
        return sev

    tl = (triage_level or "").strip().lower()
    if tl in ("call_911", "urgent"):
        return "severe"
    if tl in ("notify_care_team",):
        return "moderate"
    if tl in ("none", ""):
        return "mild"
    return "mild"


def _severity_rank(label: SeverityLabel) -> int:
    return {"none": 0, "mild": 1, "moderate": 2, "severe": 3, "urgent": 4}.get(label, 1)


def _med_label_map() -> Dict[str, str]:
    # Keep this local to doctor-api to avoid cross-service imports.
    return {
        "compazine": "Compazine (prochlorperazine) 5 mg every 6 hours",
        "zofran": "Zofran (ondansetron) 8 mg every 8 hours",
        "olanzapine": "Olanzapine 5 mg daily",
        "robitussin_10_20": "Robitussin (dextromethorphan) 10-20 mg every 4 hours",
        "robitussin_30": "Robitussin (dextromethorphan) 30 mg every 6-8 hours",
        "imodium": "Imodium (loperamide) 4 mg then 2 mg after each loose stool",
        "lomotil": "Lomotil (diphenoxylate/atropine) 1-2 tablets up to 4 times daily",
        "miralax_qd": "Miralax 17g once daily",
        "miralax_bid": "Miralax 17g twice daily",
        "senna": "Senna 8.6mg",
        "bisacodyl": "Bisacodyl (Dulcolax)",
        "docusate": "Docusate (Colace)",
        "gabapentin": "Gabapentin",
        "duloxetine": "Duloxetine (Cymbalta)",
        "pregabalin": "Pregabalin (Lyrica)",
    }


MED_LABELS = _med_label_map()


class SeverityPoint(BaseModel):
    date: str
    value: SeverityLabel


class SeveritySeries(BaseModel):
    symptom_id: str
    symptom_name: str
    points: List[SeverityPoint]


class TemperaturePoint(BaseModel):
    date: str
    value: float


class MedicationRow(BaseModel):
    date: str
    symptom_id: str
    symptom_name: str
    severity: SeverityLabel
    medication_name: Optional[str] = None
    medication_frequency: Optional[str] = None


class PatientTrendsResponse(BaseModel):
    patient_uuid: str
    start_date: str
    end_date: str
    severity_series: List[SeveritySeries]
    temperature_series: List[TemperaturePoint]
    medications: List[MedicationRow]
    chemo_dates: List[str] = []
    last_chemo_date: Optional[str] = None


class SharedQuestionResponse(BaseModel):
    id: str
    question_text: str
    category: Optional[str] = None
    is_answered: bool
    created_at: Optional[str] = None


@router.get(
    "/patient/{patient_uuid}/questions",
    response_model=APIResponse[List[SharedQuestionResponse]],
    summary="Patient shared questions",
    description="List all questions for a patient UUID.",
)
def get_patient_shared_questions(
    patient_uuid: UUID,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_roles("physician", "nurse", "admin")),
    patient_db: Session = Depends(get_patient_db_session),
    doctor_db: Session = Depends(get_doctor_db_session),
):
    """
    Returns questions for the provided patient UUID, after validating that the
    requester is authorized for this patient assignment.
    """
    assert_staff_can_access_dashboard_patient(doctor_db, current_user, patient_uuid)

    rows = patient_db.execute(
        text(
            """
        SELECT id, question_text, category, is_answered, created_at
        FROM patient_questions
        WHERE patient_uuid = :patient_uuid
        ORDER BY created_at DESC
        LIMIT :limit
        """
        ),
        {"patient_uuid": str(patient_uuid), "limit": limit},
    ).mappings().all()

    questions = [
        SharedQuestionResponse(
            id=str(r["id"]),
            question_text=r["question_text"],
            category=r["category"],
            is_answered=bool(r["is_answered"]),
            created_at=r["created_at"].isoformat() if r.get("created_at") else None,
        )
        for r in rows
    ]

    return APIResponse(
        success=True,
        message="Patient questions fetched successfully",
        data=questions,
    )


@router.get(
    "/patient/{patient_uuid}/trends",
    response_model=PatientTrendsResponse,
    summary="Patient dashboard trends (severity + daily temp + meds)",
)
def get_patient_trends(
    patient_uuid: UUID,
    start_date: Optional[date] = Query(default=None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(default=None, description="End date (YYYY-MM-DD)"),
    current_user=Depends(require_roles("physician", "nurse", "admin")),
    patient_db: Session = Depends(get_patient_db_session),
    doctor_db: Session = Depends(get_doctor_db_session),
):
    """
    Returns backend-only data for the doctor-side patient dashboard graph:
    - Symptom severity series: string values per day (worst severity per day)
    - Temperature series: one point per day (latest recorded temp per day)
    - Medications table rows: extracted from answers_json when present
    """
    # Defaults: last 30 days
    today = datetime.utcnow().date()
    start = start_date or (today - timedelta(days=30))
    end = end_date or today
    if end < start:
        raise HTTPException(status_code=400, detail="end_date must be >= start_date")

    # Authorization: physician/nurse must have access to patient (admin allowed).
    # Best-effort check using fax patient id mapping via UUID.
    if getattr(current_user, "role", None) != "admin":
        # `require_roles()` returns the doctor-api `User` model. Other endpoints use `current_user.id`.
        staff = doctor_db.query(Staff).filter(Staff.user_id == getattr(current_user, "id", None)).first()
        if staff:
            if getattr(current_user, "role", None) == "physician":
                allowed = (
                    doctor_db.query(PhysicianPatient)
                    .join(FaxPatient, FaxPatient.id == PhysicianPatient.patient_id)
                    .join(User, User.id == FaxPatient.user_id)
                    .filter(
                        PhysicianPatient.physician_id == staff.id,
                        User.uuid == patient_uuid,
                    )
                    .first()
                )
                if not allowed:
                    raise HTTPException(status_code=403, detail="Not authorized for this patient")
            elif getattr(current_user, "role", None) == "nurse":
                physician_ids = doctor_db.query(PhysicianNurseAssignment.physician_id).filter(
                    PhysicianNurseAssignment.nurse_id == staff.id
                ).all()
                physician_ids = [p[0] for p in physician_ids]
                if physician_ids:
                    allowed = (
                        doctor_db.query(PhysicianPatient)
                        .join(FaxPatient, FaxPatient.id == PhysicianPatient.patient_id)
                        .join(User, User.id == FaxPatient.user_id)
                        .filter(
                            PhysicianPatient.physician_id.in_(physician_ids),
                            User.uuid == patient_uuid,
                        )
                        .first()
                    )
                    if not allowed:
                        raise HTTPException(status_code=403, detail="Not authorized for this patient")

    start_dt = datetime.combine(start, time.min)
    end_dt = datetime.combine(end, time.max)

    # Symptom details (severity + meds)
    details = patient_db.execute(
        text(
            """
            SELECT symptom_id, severity, triage_level, answers_json, created_at
            FROM symptom_details
            WHERE patient_id = :patient_id
              AND created_at >= :start_dt
              AND created_at <= :end_dt
            ORDER BY created_at ASC
            """
        ),
        {"patient_id": str(patient_uuid), "start_dt": start_dt, "end_dt": end_dt},
    ).mappings().all()

    severity_by_symptom_day: Dict[str, Dict[str, SeverityLabel]] = {}
    meds_rows: List[MedicationRow] = []
    for row in details:
        created_at = row.get("created_at")
        if not created_at:
            continue
        day = created_at.date().isoformat()
        sid = row.get("symptom_id")
        if not sid:
            continue
        sev = _severity_from_detail(row)

        by_day = severity_by_symptom_day.setdefault(sid, {})
        prev = by_day.get(day)
        if prev is None or _severity_rank(sev) > _severity_rank(prev):
            by_day[day] = sev

        answers = row.get("answers_json") if isinstance(row.get("answers_json"), dict) else {}
        meds_val = answers.get("meds")
        if isinstance(meds_val, str) and meds_val and meds_val != "none":
            med_name = MED_LABELS.get(meds_val, meds_val)
            freq = answers.get("meds_detail")
            if not isinstance(freq, str):
                freq = None
            meds_rows.append(
                MedicationRow(
                    date=day,
                    symptom_id=sid,
                    symptom_name=_symptom_name(sid),
                    severity=sev,
                    medication_name=med_name,
                    medication_frequency=freq,
                )
            )

    severity_series: List[SeveritySeries] = []
    for sid, day_map in severity_by_symptom_day.items():
        pts = [SeverityPoint(date=d, value=v) for d, v in sorted(day_map.items(), key=lambda kv: kv[0])]
        severity_series.append(SeveritySeries(symptom_id=sid, symptom_name=_symptom_name(sid), points=pts))
    severity_series.sort(key=lambda s: s.symptom_name.lower())

    # Temperature series: highest temperature per day across all symptoms.
    # This avoids "overwrite" behavior when multiple chats/symptoms capture temperature
    # on the same day (FE expects the day's max temperature).
    temps = patient_db.execute(
        text(
            """
            SELECT metric_value, recorded_at
            FROM symptom_time_series
            WHERE patient_id = :patient_id
              AND metric_name ILIKE '%temp%'
              AND recorded_at >= :start_dt
              AND recorded_at <= :end_dt
            ORDER BY recorded_at ASC
            """
        ),
        {"patient_id": str(patient_uuid), "start_dt": start_dt, "end_dt": end_dt},
    ).mappings().all()

    max_temp_by_day: Dict[str, float] = {}
    for t in temps:
        recorded_at = t.get("recorded_at")
        metric_value = t.get("metric_value")
        if not recorded_at or metric_value is None:
            continue
        val = float(metric_value)
        day = recorded_at.date().isoformat()
        prev = max_temp_by_day.get(day)
        if prev is None or val > prev:
            max_temp_by_day[day] = val

    temperature_series = [
        TemperaturePoint(date=day, value=value)
        for day, value in sorted(max_temp_by_day.items(), key=lambda kv: kv[0])
    ]

    meds_rows.sort(key=lambda r: r.date, reverse=True)

    # Chemo dates: read from engine_state across all conversations.
    # last_chemo_date is the canonical field (set by the engine going forward):
    #   - chemo_today=Yes  → last_chemo_date = today's UTC date (automatic)
    #   - chemo_today=No   → last_chemo_date = calendar date the patient selected
    # next_chemo_date is checked as a fallback for sessions recorded before the
    # last_chemo_date field was introduced (chemo_today=No, date stored only there).
    chemo_rows = patient_db.execute(
        text(
            """
            SELECT DISTINCT chemo_date FROM (
                SELECT engine_state->>'last_chemo_date' AS chemo_date
                FROM conversations
                WHERE patient_uuid = :patient_id
                  AND engine_state->>'last_chemo_date' IS NOT NULL
                  AND engine_state->>'last_chemo_date' != ''
                  AND (engine_state->>'last_chemo_date')::date >= :start_date
                  AND (engine_state->>'last_chemo_date')::date <= :end_date

                UNION

                SELECT engine_state->>'next_chemo_date' AS chemo_date
                FROM conversations
                WHERE patient_uuid = :patient_id
                  AND (engine_state->>'chemo_today') = 'false'
                  AND engine_state->>'next_chemo_date' IS NOT NULL
                  AND engine_state->>'next_chemo_date' != ''
                  AND (engine_state->>'next_chemo_date')::date >= :start_date
                  AND (engine_state->>'next_chemo_date')::date <= :end_date
            ) combined
            ORDER BY chemo_date ASC
            """
        ),
        {"patient_id": str(patient_uuid), "start_date": start, "end_date": end},
    ).mappings().all()

    chemo_dates = sorted({row["chemo_date"] for row in chemo_rows if row.get("chemo_date")})

    # Latest known chemo date (independent of selected chart date range)
    latest_chemo_row = patient_db.execute(
        text(
            """
            SELECT chemo_date FROM (
                SELECT engine_state->>'last_chemo_date' AS chemo_date
                FROM conversations
                WHERE patient_uuid = :patient_id
                  AND engine_state->>'last_chemo_date' IS NOT NULL
                  AND engine_state->>'last_chemo_date' != ''

                UNION

                SELECT engine_state->>'next_chemo_date' AS chemo_date
                FROM conversations
                WHERE patient_uuid = :patient_id
                  AND (engine_state->>'chemo_today') = 'false'
                  AND engine_state->>'next_chemo_date' IS NOT NULL
                  AND engine_state->>'next_chemo_date' != ''
            ) combined
            ORDER BY (chemo_date)::date DESC
            LIMIT 1
            """
        ),
        {"patient_id": str(patient_uuid)},
    ).mappings().first()
    last_chemo_date = latest_chemo_row.get("chemo_date") if latest_chemo_row else None

    return PatientTrendsResponse(
        patient_uuid=str(patient_uuid),
        start_date=start.isoformat(),
        end_date=end.isoformat(),
        severity_series=severity_series,
        temperature_series=temperature_series,
        medications=meds_rows,
        chemo_dates=chemo_dates,
        last_chemo_date=last_chemo_date,
    )


# =============================================================================
# Patient profile update (doctor portal)
# =============================================================================


def _age_from_dob(dob: date) -> int:
    today = date.today()
    age = today.year - dob.year
    if (today.month, today.day) < (dob.month, dob.day):
        age -= 1
    return age


def assert_staff_can_access_dashboard_patient(
    doctor_db: Session,
    current_user: User,
    patient_uuid: UUID,
) -> None:
    """
    Admin may access any patient. Physicians and nurses only if the patient is
    assigned to them (nurses via their supervising physicians).
    """
    role = getattr(current_user, "role", None)
    if role == "admin":
        return

    staff = (
        doctor_db.query(Staff)
        .filter(Staff.user_id == getattr(current_user, "id", None))
        .first()
    )
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized for this patient",
        )

    if role == "physician":
        allowed = (
            doctor_db.query(PhysicianPatient)
            .join(FaxPatient, FaxPatient.id == PhysicianPatient.patient_id)
            .join(User, User.id == FaxPatient.user_id)
            .filter(
                PhysicianPatient.physician_id == staff.id,
                User.uuid == patient_uuid,
                PhysicianPatient.is_active == True,  # noqa: E712
            )
            .first()
        )
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized for this patient",
            )
        return

    if role == "nurse":
        physician_ids = [
            p[0]
            for p in doctor_db.query(PhysicianNurseAssignment.physician_id)
            .filter(PhysicianNurseAssignment.nurse_id == staff.id)
            .all()
        ]
        if not physician_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized for this patient",
            )
        allowed = (
            doctor_db.query(PhysicianPatient)
            .join(FaxPatient, FaxPatient.id == PhysicianPatient.patient_id)
            .join(User, User.id == FaxPatient.user_id)
            .filter(
                PhysicianPatient.physician_id.in_(physician_ids),
                User.uuid == patient_uuid,
                PhysicianPatient.is_active == True,  # noqa: E712
            )
            .first()
        )
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized for this patient",
            )
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authorized for this patient",
    )


class PatientProfileUpdateRequest(BaseModel):
    # Match AddManualPatientRequest payload (all optional)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    mrn: Optional[str] = None
    date_of_birth: Optional[str] = None  # accepts same formats as AddManualPatientRequest
    age: Optional[int] = None
    gender: Optional[str] = None
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    bmi: Optional[str] = None
    location: Optional[str] = None
    cancer_type: Optional[str] = None
    diagnosis: Optional[str] = None
    physician_ids: Optional[List[int]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    plan_name: Optional[str] = None
    regimen_name: Optional[str] = None
    past_medical_history: Optional[str] = None
    past_surgical_history: Optional[str] = None
    chemotherapy_day: Optional[str] = None
    next_chemotherapy_date: Optional[str] = None


class PatientProfileResponse(BaseModel):
    patient_uuid: str
    mrn: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    bmi: Optional[str] = None
    location: Optional[str] = None
    cancer_type: Optional[str] = None
    diagnosis: Optional[str] = None
    plan_name: Optional[str] = None
    regimen_name: Optional[str] = None
    past_medical_history: Optional[str] = None
    past_surgical_history: Optional[str] = None
    chemotherapy_day: Optional[str] = None
    next_chemotherapy_at: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    physician_ids: Optional[List[int]] = None


def _patient_profile_response_from_fax(
    fax_patient: FaxPatient, patient_uuid: UUID
) -> PatientProfileResponse:
    u = fax_patient.user
    return PatientProfileResponse(
        patient_uuid=str(patient_uuid),
        mrn=fax_patient.mrn,
        first_name=fax_patient.first_name,
        last_name=fax_patient.last_name,
        email=u.email if u else fax_patient.email,
        phone_number=fax_patient.phone_number,
        date_of_birth=fax_patient.date_of_birth.isoformat()
        if fax_patient.date_of_birth
        else None,
        age=fax_patient.age,
        gender=fax_patient.gender,
        bmi=fax_patient.bmi,
        location=fax_patient.location,
        cancer_type=fax_patient.cancer_type,
        diagnosis=fax_patient.diagnosis,
        plan_name=fax_patient.plan_name,
        regimen_name=fax_patient.regimen_name,
        past_medical_history=fax_patient.past_medical_history,
        past_surgical_history=fax_patient.past_surgical_history,
        chemotherapy_day=fax_patient.chemotherapy_day,
        next_chemotherapy_at=fax_patient.next_chemotherapy_at.isoformat()
        if fax_patient.next_chemotherapy_at
        else None,
        start_date=fax_patient.start_date.isoformat() if fax_patient.start_date else None,
        end_date=fax_patient.end_date.isoformat() if fax_patient.end_date else None,
        physician_ids=[a.physician_id for a in getattr(fax_patient, "physician_assignments", [])],
    )


def _sync_patient_info_demographics(
    patient_db: Session,
    patient_uuid: UUID,
    payload: Dict[str, Any],
) -> None:
    """Best-effort sync of overlapping columns on patient_info (patient DB)."""
    if not payload:
        return
    column_map = {
        "first_name": payload.get("first_name"),
        "last_name": payload.get("last_name"),
        "email_address": payload.get("email_address"),
        "phone_number": payload.get("phone_number"),
        "dob": payload.get("dob"),
        "mrn": payload.get("mrn"),
        "sex": payload.get("sex"),
        "treatment_type": payload.get("treatment_type"),
    }
    sets = []
    params: Dict[str, Any] = {"uuid": str(patient_uuid)}
    for col, val in column_map.items():
        if val is not None:
            sets.append(f"{col} = :{col}")
            params[col] = val
    if not sets:
        return
    sql = f"""
        UPDATE patient_info
        SET {", ".join(sets)}
        WHERE uuid = CAST(:uuid AS uuid) AND is_deleted = false
    """
    patient_db.execute(text(sql), params)
    patient_db.commit()


@router.patch(
    "/patient/{patient_uuid}/profile",
    response_model=APIResponse[PatientProfileResponse],
    summary="Update patient profile",
    description=(
        "Update demographic and treatment fields for a patient. "
        "Admins may edit any patient; physicians and nurses only patients "
        "assigned to them (nurses via their physicians)."
    ),
)
def patch_patient_profile(
    patient_uuid: UUID,
    body: PatientProfileUpdateRequest,
    current_user: User = Depends(require_roles("physician", "nurse", "admin")),
    patient_db: Session = Depends(get_patient_db_session),
    doctor_db: Session = Depends(get_doctor_db_session),
):
    assert_staff_can_access_dashboard_patient(doctor_db, current_user, patient_uuid)

    fax_patient = (
        doctor_db.query(FaxPatient)
        .join(User, User.id == FaxPatient.user_id)
        .filter(User.uuid == patient_uuid)
        .first()
    )
    if not fax_patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found for this identifier",
        )

    data = body.model_dump(exclude_unset=True)
    if not data:
        return APIResponse(
            success=True,
            message="No changes submitted; returning current profile.",
            data=_patient_profile_response_from_fax(fax_patient, patient_uuid),
        )

    patient_user = fax_patient.user
    new_email = data.get("email")
    if new_email and patient_user:
        taken = (
            doctor_db.query(User)
            .filter(
                User.email == str(new_email),
                User.id != patient_user.id,
            )
            .first()
        )
        if taken:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already in use",
            )
        conflict_pi = patient_db.execute(
            text(
                """
                SELECT 1 FROM patient_info
                WHERE email_address = :email
                  AND uuid != CAST(:uuid AS uuid)
                  AND is_deleted = false
                LIMIT 1
                """
            ),
            {"email": str(new_email), "uuid": str(patient_uuid)},
        ).first()
        if conflict_pi:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already in use",
            )

    new_mrn = data.get("mrn")
    if new_mrn is not None and str(new_mrn).strip() != "":
        taken_mrn = (
            doctor_db.query(FaxPatient)
            .filter(
                FaxPatient.mrn == str(new_mrn).strip(),
                FaxPatient.id != fax_patient.id,
            )
            .first()
        )
        if taken_mrn:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MRN is already in use",
            )
        conflict_mrn_pi = patient_db.execute(
            text(
                """
                SELECT 1 FROM patient_info
                WHERE mrn = :mrn
                  AND uuid != CAST(:uuid AS uuid)
                  AND is_deleted = false
                LIMIT 1
                """
            ),
            {"mrn": str(new_mrn).strip(), "uuid": str(patient_uuid)},
        ).first()
        if conflict_mrn_pi:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MRN is already in use",
            )

    if "mrn" in data:
        fax_patient.mrn = str(data["mrn"]).strip() if data["mrn"] else None
    if "first_name" in data:
        fax_patient.first_name = data["first_name"]
        if patient_user:
            patient_user.first_name = data["first_name"]
    if "last_name" in data:
        fax_patient.last_name = data["last_name"]
        if patient_user:
            patient_user.last_name = data["last_name"]
    if "email" in data and patient_user:
        patient_user.email = str(data["email"])
        fax_patient.email = str(data["email"])
    elif "email" in data:
        fax_patient.email = str(data["email"])
    if "phone_number" in data:
        fax_patient.phone_number = data["phone_number"]
    if "date_of_birth" in data:
        # Accept same date formats as AddManualPatientRequest; parse into a date
        dob_parsed = parse_date(data["date_of_birth"]) if data["date_of_birth"] else None
        fax_patient.date_of_birth = dob_parsed
        if dob_parsed:
            fax_patient.age = _age_from_dob(dob_parsed)
    if "gender" in data:
        fax_patient.gender = data["gender"]
    if "location" in data:
        fax_patient.location = data["location"]
    if "regimen_name" in data:
        fax_patient.regimen_name = data["regimen_name"]
    if "chemotherapy_day" in data:
        fax_patient.chemotherapy_day = data["chemotherapy_day"]
    # Support the same payload field name as AddManualPatientRequest
    if "next_chemotherapy_date" in data:
        fax_patient.next_chemotherapy_at = parse_date(data["next_chemotherapy_date"])

    # Additional fields matching AddManualPatientRequest
    if "bmi" in data:
        fax_patient.bmi = data["bmi"]
    if "cancer_type" in data:
        fax_patient.cancer_type = data["cancer_type"]
    if "diagnosis" in data:
        fax_patient.diagnosis = data["diagnosis"]
    if "age" in data:
        fax_patient.age = data["age"]
    if "plan_name" in data:
        fax_patient.plan_name = data["plan_name"]
    if "past_medical_history" in data:
        fax_patient.past_medical_history = data["past_medical_history"]
    if "past_surgical_history" in data:
        fax_patient.past_surgical_history = data["past_surgical_history"]
    if "start_date" in data:
        fax_patient.start_date = parse_date(data["start_date"])
    if "end_date" in data:
        fax_patient.end_date = parse_date(data["end_date"])

    doctor_db.commit()
    doctor_db.refresh(fax_patient)
    if patient_user:
        doctor_db.refresh(patient_user)

    # Update physician assignments if provided: replace existing with provided list
    if "physician_ids" in data:
        # remove existing active assignments for this patient
        doctor_db.query(PhysicianPatient).filter(PhysicianPatient.patient_id == fax_patient.id).delete()
        if data["physician_ids"]:
            for physician_id in data["physician_ids"]:
                physician = doctor_db.query(Staff).filter(Staff.id == physician_id).first()
                if not physician:
                    raise HTTPException(status_code=404, detail=f"Staff with id {physician_id} not found")
                if physician.role != "physician":
                    raise HTTPException(status_code=400, detail=f"Staff id {physician_id} is not a physician")
                assignment = PhysicianPatient(physician_id=physician_id, patient_id=fax_patient.id)
                doctor_db.add(assignment)
        doctor_db.commit()
        doctor_db.refresh(fax_patient)

    pi_updates: Dict[str, Any] = {}
    if "first_name" in data:
        pi_updates["first_name"] = fax_patient.first_name
    if "last_name" in data:
        pi_updates["last_name"] = fax_patient.last_name
    if "email" in data:
        pi_updates["email_address"] = str(data["email"])
    if "phone_number" in data:
        pi_updates["phone_number"] = fax_patient.phone_number
    if "date_of_birth" in data:
        pi_updates["dob"] = fax_patient.date_of_birth
    if "mrn" in data:
        pi_updates["mrn"] = fax_patient.mrn
    if "gender" in data:
        pi_updates["sex"] = fax_patient.gender
    if "regimen_name" in data:
        pi_updates["treatment_type"] = fax_patient.regimen_name

    try:
        _sync_patient_info_demographics(patient_db, patient_uuid, pi_updates)
    except Exception as e:
        logger.warning(
            "patient_info sync skipped or failed for %s: %s",
            patient_uuid,
            e,
        )

    return APIResponse(
        success=True,
        message="Patient profile updated successfully.",
        data=_patient_profile_response_from_fax(fax_patient, patient_uuid),
    )