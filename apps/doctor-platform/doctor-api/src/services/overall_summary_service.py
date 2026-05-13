"""
Overall Summary Service - Doctor API
=====================================

Generates an AI-powered overall clinical summary for a patient over
a specified date range, using Gemini. The summary is anchored to
chemotherapy dates (Day 0) and follows the client's specified format:

- Timeline of Significant Events
- Current Status
- Treatment / Intervention Response
"""

import re
from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime, date, time

from sqlalchemy.orm import Session
from sqlalchemy import text

from core.logging import get_logger
from core.config import settings
from services.base import BaseService
from services.redis_client import redis_client
import json

logger = get_logger(__name__)

OVERALL_SUMMARY_PROMPT = (
    "Please provide a concise oncology-style clinical summary using the "
    "patient PRO data, daily summaries, and chemotherapy dates provided below.\n\n"
    "Instructions:\n"
    "- Treat each chemotherapy date as a potential \"Day 0\" anchor.\n"
    "- For every symptom/event, calculate the relative timeline using the "
    "closest previous chemotherapy date.\n"
    "- Refer to events as Day +X instead of calendar dates whenever possible.\n"
    "- Use all provided chemotherapy dates while analyzing the timeline.\n"
    "- Identify symptom onset, progression, improvement, and resolution trends.\n"
    "- Include medication/intervention effectiveness if mentioned.\n"
    "- Focus only on clinically relevant details.\n"
    "- Avoid repetition and unnecessary detail.\n"
    "- Keep the tone professional and medically concise.\n"
    "- Total response length should remain under 200 words.\n\n"
    "Format the response exactly as:\n\n"
    "Clinical Synthesis\n\n"
    "Timeline of Significant Events\n"
    "- Bullet point timeline of major symptoms/events relative to Day 0\n\n"
    "Current Status\n"
    "- Brief snapshot of the patient's latest condition and functional status\n\n"
    "Treatment / Intervention Response\n"
    "- Brief summary of medication or intervention effectiveness\n\n"
    "Chemotherapy Dates:\n"
    "{chemotherapy_dates}\n\n"
    "Patient Daily Summaries:\n"
    "{daily_summaries}"
)


# OVERALL_SUMMARY_PROMPT = (
#     "Generate a concise oncology-style clinical synthesis using the "
#     "patient daily summaries and chemotherapy dates.\n\n"

#     "Instructions:\n"
#     "- Treat each chemotherapy date as Day 0 for that cycle.\n"
#     "- Use ONLY the exact format 'Day +X from C#'.\n"
#     "- NEVER use abbreviations such as D+X or C1D3.\n"
#     "- Focus on clinically meaningful symptom progression only.\n"
#     "- Summarize related symptoms together instead of listing every detail.\n"
#     "- Prioritize major toxicities, functional decline, infections, neurological changes, and treatment response.\n"
#     "- Avoid excessive granular details such as stool counts, exact temperatures, durations, or repetitive severity wording unless clinically critical.\n"
#     "- Avoid repeating the same symptom multiple times.\n"
#     "- Keep the tone medically concise and professional.\n"
#     "- Total response must remain under 200 words.\n\n"

#     "Format EXACTLY as:\n\n"

#     "Clinical Synthesis\n\n"

#     "Timeline of Significant Events\n"
#     "- Day +X from C#: concise clinically meaningful event summary\n\n"

#     "Current Status\n"
#     "- Brief overall current clinical condition\n\n"

#     "Treatment / Intervention Response\n"
#     "- Brief summary of medication/intervention effectiveness\n\n"

#     "Chemotherapy Dates:\n"
#     "{chemotherapy_dates}\n\n"

#     "Patient Daily Summaries:\n"
#     "{daily_summaries}"
# )

# ---------------------------------------------------------------------------
# Response model for the overall summary
# ---------------------------------------------------------------------------
class OverallSummaryResponse:
    """Response containing the generated overall summary."""

    def __init__(
        self,
        summary: str,
        anchor_date: Optional[str] = None,
        chemo_dates: Optional[List[str]] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        conversation_count: int = 0,
    ):
        self.summary = summary
        self.anchor_date = anchor_date
        self.chemo_dates = chemo_dates or []
        self.start_date = start_date
        self.end_date = end_date
        self.conversation_count = conversation_count

    def to_dict(self) -> Dict[str, Any]:
        return {
            "summary": self.summary,
            "anchor_date": self.anchor_date,
            "chemo_dates": self.chemo_dates,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "conversation_count": self.conversation_count,
        }


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------
class OverallSummaryService(BaseService):
    """
    Service for generating AI-powered overall clinical summaries
    over a given date range, anchored to chemotherapy dates.
    """

    def __init__(self, patient_db: Session, doctor_db: Session):
        super().__init__(doctor_db)
        self.patient_db = patient_db

    def _get_cache_key(
        self,
        patient_uuid,
        start_date,
        end_date,
    ):
        return (
            f"overall_summary:"
            f"{patient_uuid}:"
            f"{start_date}:"
            f"{end_date}"
        )

    # =========================================================================
    # Public API
    # =========================================================================

    def generate(
        self,
        patient_uuid: UUID,
        start_date: date,
        end_date: date,
    ) -> OverallSummaryResponse:
        """
        Generate an overall oncology-style clinical summary for the patient
        within the specified date range.

        Steps:
        1. Fetch all completed conversations in the range
        2. Fetch chemo dates in the range
        3. Build the prompt with daily summaries + chemo dates
        4. Call Gemini for the summary
        5. Return structured result
        """
        logger.info(
            f"Generating overall summary for patient {patient_uuid} "
            f"from {start_date} to {end_date}"
        )

        cache_key = self._get_cache_key(
            patient_uuid,
            start_date,
            end_date,
        )

        cached_data = redis_client.get(cache_key)

        if cached_data:
            logger.info("Returning overall summary from Redis cache")

            return OverallSummaryResponse(
                **json.loads(cached_data)
            )

        # 1. Fetch conversations
        conversations = self._fetch_conversations(patient_uuid, start_date, end_date)
        if not conversations:
            logger.info(f"No conversations found for patient {patient_uuid} in range")
            return OverallSummaryResponse(
                summary="No symptom check-in data available for the selected date range.",
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat(),
                conversation_count=0,
            )

        # 2. Fetch chemo dates
        chemo_dates = self._fetch_chemo_dates(patient_uuid, start_date, end_date)

        # 3. Build prompt data
        chemo_dates_str = self._format_chemo_dates(chemo_dates)
        daily_summaries_str = self._build_daily_summaries(conversations)

        # 4. Build prompt
        prompt = OVERALL_SUMMARY_PROMPT.format(
            chemotherapy_dates=chemo_dates_str,
            daily_summaries=daily_summaries_str,
        )

        # 5. Call Gemini
        summary_text = self._call_gemini(prompt)

        if not summary_text:
            # Fallback if Gemini fails
            summary_text = self._build_fallback_summary(conversations, chemo_dates)

        result = OverallSummaryResponse(
            summary=summary_text,
            anchor_date=chemo_dates[-1] if chemo_dates else (
                conversations[0].get("created_at", "")[:10]
                if conversations[0].get("created_at")
                else None
            ),
            chemo_dates=chemo_dates,
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat(),
            conversation_count=len(conversations),
        )

        # =====================================================
        # STORE RESULT IN REDIS
        # =====================================================

        redis_client.setex(
            cache_key,
            3600,  # cache for 1 hour
            json.dumps(result.to_dict())
        )

        return result

    # =========================================================================
    # Data Fetching
    # =========================================================================

    def _fetch_conversations(
        self,
        patient_uuid: UUID,
        start_date: date,
        end_date: date,
    ) -> List[Dict[str, Any]]:
        """
        Fetch completed conversations (with bulleted_summary) from the
        patient DB within the date range.
        """
        start_dt = datetime.combine(start_date, time.min)
        end_dt = datetime.combine(end_date, time.max)

        rows = self.patient_db.execute(
            text(
                """
                SELECT
                    uuid,
                    created_at,
                    conversation_state,
                    symptom_list,
                    severity_list,
                    bulleted_summary,
                    longer_summary,
                    clinical_narrative_summary,
                    patient_narrative_summary,
                    overall_feeling,
                    medication_list,
                    triage_level
                FROM conversations
                WHERE patient_uuid = :patient_uuid
                  AND created_at >= :start_dt
                  AND created_at <= :end_dt
                  AND bulleted_summary IS NOT NULL
                ORDER BY created_at ASC
                """
            ),
            {
                "patient_uuid": str(patient_uuid),
                "start_dt": start_dt,
                "end_dt": end_dt,
            },
        ).mappings().all()

        result = []
        for row in rows:
            result.append({
                "uuid": str(row["uuid"]),
                "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
                "symptom_list": row["symptom_list"] or [],
                "bulleted_summary": row["bulleted_summary"] or "",
                "longer_summary": row["longer_summary"] or "",
                "clinical_narrative_summary": row["clinical_narrative_summary"] or "",
                "patient_narrative_summary": row["patient_narrative_summary"] or "",
                "overall_feeling": row["overall_feeling"],
                "medication_list": row["medication_list"] or [],
                "triage_level": row["triage_level"],
            })
        return result

    def _fetch_chemo_dates(
        self,
        patient_uuid: UUID,
        start_date: date,
        end_date: date,
    ) -> List[str]:
        """
        Fetch distinct chemo dates from engine_state in conversations
        within the date range.
        """
        rows = self.patient_db.execute(
            text(
                """
                SELECT DISTINCT chemo_date FROM (
                    SELECT engine_state->>'last_chemo_date' AS chemo_date
                    FROM conversations
                    WHERE patient_uuid = :patient_uuid
                      AND engine_state->>'last_chemo_date' IS NOT NULL
                      AND engine_state->>'last_chemo_date' != ''
                      AND (engine_state->>'last_chemo_date')::date >= :start_date
                      AND (engine_state->>'last_chemo_date')::date <= :end_date

                    UNION

                    SELECT engine_state->>'next_chemo_date' AS chemo_date
                    FROM conversations
                    WHERE patient_uuid = :patient_uuid
                      AND (engine_state->>'chemo_today') = 'false'
                      AND engine_state->>'next_chemo_date' IS NOT NULL
                      AND engine_state->>'next_chemo_date' != ''
                      AND (engine_state->>'next_chemo_date')::date >= :start_date
                      AND (engine_state->>'next_chemo_date')::date <= :end_date
                ) combined
                ORDER BY chemo_date ASC
                """
            ),
            {
                "patient_uuid": str(patient_uuid),
                "start_date": start_date,
                "end_date": end_date,
            },
        ).mappings().all()

        return sorted({row["chemo_date"] for row in rows if row.get("chemo_date")})

    # =========================================================================
    # Prompt Building
    # =========================================================================

    def _format_chemo_dates(self, chemo_dates: List[str]) -> str:
        """Format chemo dates as a bulleted list for the prompt."""
        if not chemo_dates:
            return "No chemotherapy dates recorded in this period."
        return "\n".join(f"- {d}" for d in chemo_dates)
    
    # def _build_daily_summaries(
    #     self,
    #     conversations: List[Dict[str, Any]],
    # ) -> str:

    #     lines = []

    #     for conv in conversations:

    #         created = conv.get("created_at", "")
    #         day_str = created[:10] if created else ""

    #         symptoms = conv.get("symptom_list", [])
    #         symptom_str = ", ".join(symptoms) if symptoms else "None"

    #         feeling = conv.get("overall_feeling") or "N/A"

    #         triage = conv.get("triage_level") or "N/A"

    #         meds = conv.get("medication_list", [])
    #         med_names = []

    #         for m in meds:
    #             if isinstance(m, dict):
    #                 name = m.get("medicineName") or m.get("name")
    #                 if name:
    #                     med_names.append(name)
    #             elif isinstance(m, str):
    #                 med_names.append(m)

    #         meds_str = ", ".join(med_names) if med_names else "None"

    #         lines.append(
    #             f"Date: {day_str} | "
    #             f"Symptoms: {symptom_str} | "
    #             f"Feeling: {feeling} | "
    #             f"Triage: {triage} | "
    #             f"Medications: {meds_str}"
    #         )

    #     return "\n".join(lines)

    def _build_daily_summaries(
        self,
        conversations: List[Dict[str, Any]],
    ) -> str:
        """
        Build a chronological list of daily summaries for the prompt.
        Uses calendar dates - Gemini will calculate Day +X offsets
        from the provided chemo dates.
        """
        lines: List[str] = []
        for conv in conversations:
            created = conv.get("created_at", "")
            if isinstance(created, str):
                day_str = created[:10]
            else:
                day_str = str(created)[:10]

            # Use the best available summary text
            summary_text = (
                conv.get("clinical_narrative_summary")
                or "No summary available"
            )

            feeling = conv.get("overall_feeling")
            feeling_str = f" [Feeling: {feeling}]" if feeling else ""

            triage = conv.get("triage_level")
            triage_str = f" [Triage: {triage}]" if triage else ""

            symptoms = conv.get("symptom_list", [])
            symptom_str = f" [Symptoms: {', '.join(symptoms)}]" if symptoms else ""

            meds = conv.get("medication_list", [])
            meds_str = ""
            if meds:
                med_names = []
                for m in meds:
                    if isinstance(m, dict):
                        name = m.get("medicineName") or m.get("name", "")
                        if name:
                            med_names.append(name)
                    elif isinstance(m, str):
                        med_names.append(m)
                if med_names:
                    meds_str = f" [Medications: {', '.join(med_names)}]"

            lines.append(
                f"Date: {day_str}{feeling_str}{triage_str}{symptom_str}{meds_str}\n"
                f"Summary: {summary_text}"
            )

        return "\n\n".join(lines) if lines else "No daily summaries available."


    # =========================================================================
    # Gemini AI Call
    # =========================================================================

    def _is_gemini_available(self) -> bool:
        """Check if Gemini API key is configured."""
        return bool(settings.gemini_api_key)

    def _call_gemini(self, prompt: str) -> Optional[str]:
        """
        Call Gemini API to generate the overall summary.
        Returns None on failure so caller can fallback.
        """
        if not self._is_gemini_available():
            logger.info("Skipping Gemini overall summary: no API key configured")
            return None

        logger.info(
            "Calling Gemini for overall summary generation: "
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
                ),
            )

            raw_text = getattr(response, "text", "") or ""
            cleaned = self._normalize_output(raw_text)
            if cleaned:
                logger.info("Gemini overall summary generated successfully")
            else:
                logger.warning("Gemini returned empty overall summary output")
            return cleaned or None

        except ImportError:
            logger.warning("google-genai package not installed")
            return None
        except Exception as exc:
            logger.error(f"Gemini overall summary generation failed: {exc}")
            return None

    @staticmethod
    def _normalize_output(text: str) -> str:
        """Normalize model output to clean text, preserving markdown structure."""
        if not text:
            return ""
        cleaned = text.strip()
        # Remove code fences
        cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
        # Normalize excessive whitespace but preserve intentional line breaks
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        cleaned = cleaned.strip()
        return cleaned

    # =========================================================================
    # Fallback Summary
    # =========================================================================

    def _build_fallback_summary(
        self,
        conversations: List[Dict[str, Any]],
        chemo_dates: List[str],
    ) -> str:
        """
        Build a deterministic fallback summary when Gemini is unavailable.
        """
        if not conversations:
            return "No symptom data available for the selected date range."

        total = len(conversations)
        symptoms_set: set = set()
        feelings: List[str] = []
        for conv in conversations:
            for s in conv.get("symptom_list", []):
                symptoms_set.add(s)
            if conv.get("overall_feeling"):
                feelings.append(str(conv.get("overall_feeling")))

        symptoms_str = ", ".join(sorted(symptoms_set)) if symptoms_set else "No symptoms reported"
        feeling_str = ", ".join(f.capitalize() for f in feelings if f) if feelings else "N/A"

        start = conversations[0].get("created_at", "")[:10] if conversations[0].get("created_at") else ""
        end = conversations[-1].get("created_at", "")[:10] if conversations[-1].get("created_at") else ""

        lines = [
            "Clinical Synthesis",
            "",
            "Timeline of Significant Events",
            f"- Over {total} check-in session(s) from {start} to {end}, "
            f"the patient reported symptoms including: {symptoms_str}.",
        ]
        if chemo_dates:
            lines.append(f"- Chemotherapy administered on: {', '.join(chemo_dates)}.")

        lines.append("")
        lines.append("Current Status")
        lines.append(f"- Patient's overall reported feeling(s) during this period: {feeling_str}.")

        lines.append("")
        lines.append("Treatment / Intervention Response")
        lines.append("- Detailed medication response data is available per session.")

        return "\n".join(lines)