from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.deps import get_current_patient_uuid, get_patient_db
from core import settings

router = APIRouter()

SeverityLabel = Literal["mild", "moderate", "severe", "urgent", "none"]


def _symptom_name(symptom_id: str) -> str:
    symptom_map = {
        "URG-101": "Trouble Breathing",
        "URG-102": "Chest Pain",
        "URG-103": "Bleeding that won’t stop with pressure",
        "URG-107": "Fainting / Syncope",
        "URG-108": "Altered Mental Status",
        "URG-114": "Port/IV Site Pain",
        "FEV-202": "Fever",
        "DEH-201": "Dehydration",
        "NAU-203": "Nausea",
        "VOM-204": "Vomiting",
        "DIA-205": "Diarrhea",
        "PAI-213": "Pain",
        "CON-210": "Constipation",
        "FAT-206": "Fatigue / Weakness",
        "NEU-216": "Neuropathy (Numbness/Tingling)",
        "COU-215": "Cough",
        "SWE-214": "Swelling",
        "MSO-208": "Mouth Sores",
        "EYE-207": "Eye Complaints",
        "SKI-212": "Skin Rash / Redness",
        "URI-211": "Urinary Problems",
        "APP-209": "No Appetite",
        "HEA-210": "Headache",
        "ABD-211": "Abdominal Pain",
        "LEG-208": "Leg/Calf Pain",
        "JMP-212": "Joint/Muscle/General Pain",
        "NEU-304": "Falls & Balance",
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

    answers = row.get("answers_json") if isinstance(row.get("answers_json"), dict) else {}
    sev = _normalize(answers.get("abd_pain_sev"))
    if sev:
        return sev
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


@router.get(
    "/patient/{patient_uuid}/trends",
    response_model=PatientTrendsResponse,
    summary="Patient dashboard trends (severity + daily temp + meds)",
)
def get_patient_trends(
    patient_uuid: UUID,
    start_date: Optional[date] = Query(default=None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(default=None, description="End date (YYYY-MM-DD)"),
    current_patient_uuid: UUID = Depends(get_current_patient_uuid),
    patient_db: Session = Depends(get_patient_db),
):
    # Auth is required. In non-local-dev, enforce strict self-access.
    # In local-dev mode, allow path UUID for easier integration testing.
    if settings.local_dev_mode:
        effective_patient_uuid = patient_uuid
    else:
        if str(current_patient_uuid) != str(patient_uuid):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access trends for this patient",
            )
        effective_patient_uuid = current_patient_uuid

    today = datetime.utcnow().date()
    start = start_date or (today - timedelta(days=30))
    end = end_date or today
    if end < start:
        raise HTTPException(status_code=400, detail="end_date must be >= start_date")

    start_dt = datetime.combine(start, time.min)
    end_dt = datetime.combine(end, time.max)

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
        {"patient_id": str(effective_patient_uuid), "start_dt": start_dt, "end_dt": end_dt},
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
        {"patient_id": str(effective_patient_uuid), "start_dt": start_dt, "end_dt": end_dt},
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
        {"patient_id": str(effective_patient_uuid), "start_date": start, "end_date": end},
    ).mappings().all()

    chemo_dates = sorted({row["chemo_date"] for row in chemo_rows if row.get("chemo_date")})

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
        {"patient_id": str(effective_patient_uuid)},
    ).mappings().first()
    last_chemo_date = latest_chemo_row.get("chemo_date") if latest_chemo_row else None

    return PatientTrendsResponse(
        patient_uuid=str(effective_patient_uuid),
        start_date=start.isoformat(),
        end_date=end.isoformat(),
        severity_series=severity_series,
        temperature_series=temperature_series,
        medications=meds_rows,
        chemo_dates=chemo_dates,
        last_chemo_date=last_chemo_date,
    )
