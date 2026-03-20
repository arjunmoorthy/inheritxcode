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
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.deps import get_current_user, get_patient_db_session, get_doctor_db_session, TokenData
from services.dashboard_service import DashboardService
from services.audit_service import AuditService
from core.logging import get_logger
from core.exceptions import NotFoundError, AuthorizationError
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
    current_user: TokenData = Depends(require_roles("physician", "nurse", "admin")),
    db: Session = Depends(get_doctor_db_session),
    patient_db: Session = Depends(get_patient_db_session),
):
    try:
        query = (
            db.query(FaxPatient)
            .join(
                PhysicianPatient,
                PhysicianPatient.patient_id == FaxPatient.id
            )
        )

        staff = db.query(Staff).filter(
            Staff.user_id == current_user.id
        ).first()

        if not staff:
            raise HTTPException(
                status_code=404,
                detail="Staff not found"
            )

        if current_user.role == "physician":
            query = query.filter(
                PhysicianPatient.physician_id == staff.id
            )

        elif current_user.role == "nurse":

            physician_ids = db.query(
                PhysicianNurseAssignment.physician_id
            ).filter(
                PhysicianNurseAssignment.nurse_id == staff.id
            ).all()

            physician_ids = [p[0] for p in physician_ids]

            if not physician_ids:
                return {"status": "success", "count": 0, "data": []}

            query = query.filter(
                PhysicianPatient.physician_id.in_(physician_ids)
            )

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

        response = [
            {
                "patient_id": p.id,
                # UUID used by dashboard trends endpoint: /dashboard/patient/{patient_uuid}/trends
                "patient_uuid": str(p.user.uuid) if getattr(p, "user", None) and getattr(p.user, "uuid", None) else None,
                "last_chemo_date": latest_chemo_by_patient.get(
                    str(p.user.uuid)
                ) if getattr(p, "user", None) and getattr(p.user, "uuid", None) else None,
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
            }
            for p in patients
        ]

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
    severity_val = row.get("severity")
    triage_level = row.get("triage_level")
    if severity_val:
        s = str(severity_val).strip().lower()
        if s in ("mild", "moderate", "severe", "urgent", "none"):
            return s  # type: ignore[return-value]
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
    severity_after_medication: Optional[str] = None


class PatientTrendsResponse(BaseModel):
    patient_uuid: str
    start_date: str
    end_date: str
    severity_series: List[SeveritySeries]
    temperature_series: List[TemperaturePoint]
    medications: List[MedicationRow]
    chemo_dates: List[str] = []
    last_chemo_date: Optional[str] = None


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
            sev_after = (
                answers.get("severity_post_meds")
                or answers.get("severity_post_med")
                or answers.get("severity_post_medication")
            )
            meds_rows.append(
                MedicationRow(
                    date=day,
                    symptom_id=sid,
                    symptom_name=_symptom_name(sid),
                    severity=sev,
                    medication_name=med_name,
                    medication_frequency=freq,
                    severity_after_medication=str(sev_after) if sev_after is not None else None,
                )
            )

    severity_series: List[SeveritySeries] = []
    for sid, day_map in severity_by_symptom_day.items():
        pts = [SeverityPoint(date=d, value=v) for d, v in sorted(day_map.items(), key=lambda kv: kv[0])]
        severity_series.append(SeveritySeries(symptom_id=sid, symptom_name=_symptom_name(sid), points=pts))
    severity_series.sort(key=lambda s: s.symptom_name.lower())

    # Temperature series: latest temp per day
    temps = patient_db.execute(
        text(
            """
            SELECT metric_value, recorded_at
            FROM symptom_time_series
            WHERE patient_id = :patient_id
              AND symptom_id = 'FEV-202'
              AND metric_name = 'temp'
              AND recorded_at >= :start_dt
              AND recorded_at <= :end_dt
            ORDER BY recorded_at ASC
            """
        ),
        {"patient_id": str(patient_uuid), "start_dt": start_dt, "end_dt": end_dt},
    ).mappings().all()

    latest_temp_by_day: Dict[str, tuple[datetime, float]] = {}
    for t in temps:
        recorded_at = t.get("recorded_at")
        metric_value = t.get("metric_value")
        if not recorded_at:
            continue
        day = recorded_at.date().isoformat()
        prev = latest_temp_by_day.get(day)
        if prev is None or recorded_at > prev[0]:
            latest_temp_by_day[day] = (recorded_at, float(metric_value))

    temperature_series = [
        TemperaturePoint(date=day, value=val_ts[1])
        for day, val_ts in sorted(latest_temp_by_day.items(), key=lambda kv: kv[0])
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