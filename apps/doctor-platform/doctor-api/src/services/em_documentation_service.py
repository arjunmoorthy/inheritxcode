"""
E&M Documentation Service - Doctor API
======================================

Generates an EHR-ready Evaluation & Management note from patient trends
and tracker data in a single Gemini call, following CMS MDM guidelines.
"""

import json
import re
from datetime import date
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from core.config import settings
from core.logging import get_logger
from services.base import BaseService
from services.overall_summary_service import OverallSummaryService

logger = get_logger(__name__)

EM_DOCUMENTATION_PROMPT = """Please synthesize the following raw data/tracker info into an EHR-ready note based on current CMS E&M guidelines for Medical Decision Making (MDM):

Format the note using an ultra-lean, highly condensed EHR format with minimal narrative text, heavy bulleting, and explicit billing indicators for maximum scannability. Use the following specific headings:

1. CHIEF COMPLAINT / REASON FOR ENCOUNTER: State via a brief, single-sentence bullet that a separate evaluation was required to manage treatment-limiting toxicities distinct from routine pre-infusion protocols.

2. INTERVAL HISTORY OF PRESENT ILLNESS (HPI): Synthesize the trend graph data, key milestones (e.g., Day 0 to Day +6 changes), and interval symptoms into a lean, bulleted timeline showing how toxicities impact daily functional tasks.

3. DATA REVIEWED & ANALYZED: Document the personal review and analysis of the remote chemo tracker data, unique external reports, and symptom/temperature trend lines over the specified date range using an abbreviated checklist layout.

4. ASSESSMENT & PLAN: Create a numbered problem list including the primary cancer diagnosis and each active toxicity/symptom. For each, include:
   - Status: 1-2 words on clinical complexity (e.g., Acute progression, Stable, Functional interference).
   - Plan: Bulleted active management, prescription drug tracking, or explicit next clinical steps.

5. BILLING & CODING SUMMARY: Outline the target E&M Level (aim for Level 4 / 99214 based on Moderate Complexity MDM, unless data dictates otherwise), list Modifier 25, and provide a clear mapping of primary and secondary supportive ICD-10 diagnosis categories.

6. LEVEL 5 ELEVATION SUMMARY: Provide a brief, side-by-side or highly concise comparison table/breakdown showing exactly what specific thresholds or severe data abnormalities would be required in Column 1 (Problem), Column 2 (Data), and Column 3 (Risk) to elevate this specific case to a Level 5 (99215).

Maintain a formal, highly technical medical tone appropriate for direct EHR entry. Do not include any introductory text or conversational meta-commentary—provide ONLY the structured sections.

=== DATE RANGE ===
{date_range}

=== PATIENT CONTEXT ===
{patient_context}

=== CHEMOTHERAPY DATES (Day 0 anchors) ===
{chemotherapy_dates}

=== PATIENT DAILY SUMMARIES ===
{daily_summaries}

=== TRENDS DATA (severity, temperature, medications) ===
{trends_data}
"""


class EmDocumentationResponse:
    """Response containing the generated E&M documentation note."""

    def __init__(self, em_text: str):
        self.em_text = em_text

    def to_dict(self) -> Dict[str, str]:
        return {"E&M": self.em_text}


class EmDocumentationService(BaseService):
    """
    Service for generating E&M documentation notes from trends and raw
    tracker data (single Gemini call; no separate overall-summary synthesis).
    """

    def __init__(self, patient_db: Session, doctor_db: Session):
        super().__init__(doctor_db)
        self.patient_db = patient_db
        self._summary_data = OverallSummaryService(patient_db, doctor_db)

    def generate(
        self,
        patient_uuid: UUID,
        start_date: date,
        end_date: date,
        trends: Dict[str, Any],
    ) -> EmDocumentationResponse:
        patient_context = self._fetch_patient_context(patient_uuid)
        conversations = self._summary_data._fetch_conversations(
            patient_uuid, start_date, end_date
        )
        chemo_dates = self._summary_data._fetch_chemo_dates(
            patient_uuid, start_date, end_date
        )
        daily_summaries = self._summary_data._build_daily_summaries(conversations)
        chemotherapy_dates = self._summary_data._format_chemo_dates(chemo_dates)

        prompt = self._build_prompt(
            start_date=start_date,
            end_date=end_date,
            patient_context=patient_context,
            chemotherapy_dates=chemotherapy_dates,
            daily_summaries=daily_summaries,
            trends=trends,
        )

        note_text = self._call_gemini(prompt)
        if not note_text:
            note_text = self._build_fallback_note(
                trends=trends,
                patient_context=patient_context,
                chemotherapy_dates=chemotherapy_dates,
                daily_summaries=daily_summaries,
                conversation_count=len(conversations),
                start_date=start_date,
                end_date=end_date,
            )

        return EmDocumentationResponse(em_text=self._sanitize_output(note_text))

    def _fetch_patient_context(self, patient_uuid: UUID) -> str:
        row = self.db.execute(
            text(
                """
                SELECT
                    fp.first_name,
                    fp.last_name,
                    fp.cancer_type,
                    fp.diagnosis,
                    fp.regimen_name,
                    fp.plan_name,
                    fp.stage
                FROM fax_patients fp
                JOIN users u ON u.id = fp.user_id
                WHERE u.uuid = :patient_uuid
                LIMIT 1
                """
            ),
            {"patient_uuid": str(patient_uuid)},
        ).mappings().first()

        if not row:
            return "No patient profile on file."

        parts = []
        name = " ".join(
            p for p in [row.get("first_name"), row.get("last_name")] if p
        ).strip()
        if name:
            parts.append(f"Patient: {name}")
        if row.get("cancer_type"):
            parts.append(f"Cancer type: {row['cancer_type']}")
        if row.get("diagnosis"):
            parts.append(f"Diagnosis: {row['diagnosis']}")
        if row.get("regimen_name"):
            parts.append(f"Regimen: {row['regimen_name']}")
        if row.get("plan_name"):
            parts.append(f"Plan: {row['plan_name']}")
        if row.get("stage"):
            parts.append(f"Stage: {row['stage']}")
        return "\n".join(parts) if parts else "No patient profile on file."

    def _build_prompt(
        self,
        start_date: date,
        end_date: date,
        patient_context: str,
        chemotherapy_dates: str,
        daily_summaries: str,
        trends: Dict[str, Any],
    ) -> str:
        trends_compact = self._compact_trends(trends)
        trends_json = json.dumps(trends_compact, separators=(",", ":"), default=str)

        return EM_DOCUMENTATION_PROMPT.format(
            date_range=f"{start_date.isoformat()} to {end_date.isoformat()}",
            patient_context=patient_context,
            chemotherapy_dates=chemotherapy_dates,
            daily_summaries=daily_summaries,
            trends_data=trends_json,
        )

    @staticmethod
    def _compact_trends(trends: Dict[str, Any]) -> Dict[str, Any]:
        """Drop empty series and redundant fields to reduce prompt size."""
        severity = [
            {
                "symptom": s.get("symptom_name") or s.get("symptom_id"),
                "points": s.get("points") or [],
            }
            for s in (trends.get("severity_series") or [])
            if s.get("points")
        ]
        return {
            "start_date": trends.get("start_date"),
            "end_date": trends.get("end_date"),
            "chemo_dates": trends.get("chemo_dates") or [],
            "last_chemo_date": trends.get("last_chemo_date"),
            "severity_series": severity,
            "temperature_series": trends.get("temperature_series") or [],
            "medications": trends.get("medications") or [],
        }

    def _is_gemini_available(self) -> bool:
        return bool(settings.gemini_api_key)

    def _call_gemini(self, prompt: str) -> Optional[str]:
        if not self._is_gemini_available():
            logger.info("Skipping Gemini E&M documentation: no API key configured")
            return None

        logger.info(
            "Calling Gemini for E&M documentation: "
            f"prompt_chars={len(prompt)}, model={settings.gemini_model}"
        )

        try:
            from google import genai
            from google.genai import types as genai_types

            client = genai.Client(api_key=settings.gemini_api_key)
            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    temperature=0.2,
                    top_p=0.95,
                    max_output_tokens=4096,
                ),
            )

            raw_text = getattr(response, "text", "") or ""
            cleaned = self._normalize_output(raw_text)
            if cleaned:
                logger.info("Gemini E&M documentation generated successfully")
            else:
                logger.warning("Gemini returned empty E&M documentation output")
            return cleaned or None

        except ImportError:
            logger.warning("google-genai package not installed")
            return None
        except Exception as exc:
            logger.error(f"Gemini E&M documentation generation failed: {exc}")
            return None

    @staticmethod
    def _normalize_output(text: str) -> str:
        if not text:
            return ""
        cleaned = text.strip()
        cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()

    @staticmethod
    def _sanitize_output(text: str) -> str:
        """Strip markdown bold and newlines for API response."""
        if not text:
            return ""
        cleaned = EmDocumentationService._normalize_output(text)
        cleaned = cleaned.replace("**", "")
        cleaned = cleaned.replace("\n", " ")
        cleaned = re.sub(r"\s{2,}", " ", cleaned)
        return cleaned.strip()

    def _build_fallback_note(
        self,
        trends: Dict[str, Any],
        patient_context: str,
        chemotherapy_dates: str,
        daily_summaries: str,
        conversation_count: int,
        start_date: date,
        end_date: date,
    ) -> str:
        chemo_dates = trends.get("chemo_dates") or []
        severity_series = trends.get("severity_series") or []
        temperature_series = trends.get("temperature_series") or []
        medications = trends.get("medications") or []

        symptom_lines = []
        for series in severity_series[:8]:
            name = series.get("symptom_name") or series.get("symptom_id")
            points = series.get("points") or []
            if points:
                latest = points[-1]
                symptom_lines.append(
                    f"- {name}: {latest.get('value')} on {latest.get('date')}"
                )

        temp_lines = [
            f"- {p.get('date')}: {p.get('value')}°F"
            for p in temperature_series[-5:]
        ]

        med_lines = [
            f"- {m.get('date')}: {m.get('medication_name')} ({m.get('symptom_name')})"
            for m in medications[:5]
        ]

        return "\n".join(
            [
                "1. CHIEF COMPLAINT / REASON FOR ENCOUNTER",
                "- Separate evaluation required for treatment-limiting toxicities "
                "distinct from routine pre-infusion protocols.",
                "",
                "2. INTERVAL HISTORY OF PRESENT ILLNESS (HPI)",
                f"- Review period: {start_date.isoformat()} to {end_date.isoformat()}.",
                chemotherapy_dates,
                daily_summaries[:2000] if daily_summaries else "No daily summaries.",
                *symptom_lines,
                "",
                "3. DATA REVIEWED & ANALYZED",
                "- [x] Remote chemo tracker PRO data",
                "- [x] Symptom severity trend lines",
                "- [x] Daily temperature trend lines",
                "- [x] Medication tracking entries",
                f"- [x] Daily check-in summaries ({conversation_count} sessions)",
                "",
                "4. ASSESSMENT & PLAN",
                patient_context,
                "1. Primary malignancy — Status: Stable — Plan: Continue oncologic regimen per treating team.",
                *[
                    f"{i + 2}. {line.lstrip('- ')} — Status: See trends — Plan: Symptom-directed management per protocol."
                    for i, line in enumerate(symptom_lines[:5])
                ],
                "",
                "5. BILLING & CODING SUMMARY",
                "- Target E&M: Level 4 / 99214 (Moderate MDM) — Modifier 25 indicated.",
                "- Primary ICD-10: malignancy category per chart diagnosis.",
                "- Secondary ICD-10: supportive toxicity/symptom categories per active problems.",
                "",
                "6. LEVEL 5 ELEVATION SUMMARY",
                "| MDM Column | Level 5 (99215) threshold for this case |",
                "| Problem | New/worsening toxicity with threat to organ function or life |",
                "| Data | Independent interpretation of unique test + external records review |",
                "| Risk | High-risk drug therapy, decision re: hospitalization, or emergency surgery |",
                "",
                "Temperature highlights:",
                *temp_lines,
                "",
                "Medication highlights:",
                *med_lines,
            ]
        )
