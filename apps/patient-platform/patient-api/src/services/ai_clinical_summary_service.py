"""
AI Clinical Summary Service.

Generates physician-facing clinical narrative summaries from the full chat
transcript using Gemini. Falls back to deterministic summary generation in the
caller when unavailable or on errors.
"""

import asyncio
import re
from typing import List, Optional

from google import genai
from google.genai import types

from core.config import settings
from core.logging import get_logger
from db.patient_models import Messages as MessageModel

logger = get_logger(__name__)


DOCTOR_SUMMARY_PROMPT = (
    "Summarize the patient's symptom report into a single physician-facing "
    "paragraph. Include all symptoms the patient reported, regardless of "
    "severity or duration (including fever, nausea, fatigue, mouth sores, "
    "rash, abdominal pain, appetite changes, hydration changes, or any other "
    "symptom). For each symptom, note severity, duration, interventions tried, "
    "response, and any associated features. Include oral intake, hydration "
    "status, functional status (ADLs), temperature, weight changes, and any "
    "early concerning signs such as decreased urine output or pain with "
    "swallowing. Do not infer or assign causality between symptoms unless "
    "explicitly stated by the patient. Instead, describe symptoms as "
    "co-occurring or associated when relevant. Write in neutral clinical "
    "language, in 3-5 sentences, without including recommendations, triage "
    "levels, or next steps. Ensure nothing reported is omitted. If there are "
    "any emergent symptoms, that should be the first symptom reported."

    "Normalize and expand all abbreviations into proper clinical terminology "
    "(e.g., 'hr' → 'heart rate'). If a heart rate value is available, you MUST "
    "include the numeric value in beats per minute (e.g., 'heart rate of 110 bpm'). "
    "If the heart rate is indicated as elevated but no exact number is available, "
    "state it as 'heart rate >100 bpm'. Do not use vague phrases like "
    "'elevated heart rate' without a number or threshold."
)

PATIENT_SUMMARY_PROMPT = (
    "Summarize the patient's symptom report into a single patient-facing "
    "paragraph written in second-person voice. Include all symptoms the patient "
    "reported, regardless of severity or duration (including fever, nausea, "
    "fatigue, mouth sores, rash, abdominal pain, appetite changes, hydration "
    "changes, or any other symptom). For each symptom, include severity, "
    "duration, interventions tried, response, and associated features. Include "
    "oral intake, hydration status, daily activity impact (ADLs), temperature, "
    "weight changes, and early concerning signs such as decreased urine output "
    "or pain with swallowing. Do not infer or assign causality between symptoms "
    "unless explicitly stated by the patient. Instead, describe symptoms as "
    "co-occurring or associated when relevant. Use clear and simple language in "
    "3-5 sentences. Do not include recommendations, triage levels, or next "
    "steps. Ensure nothing reported is omitted."

    "Normalize and expand all abbreviations into proper clinical terminology "
    "(e.g., 'hr' → 'heart rate'). If a heart rate value is available, you MUST "
    "include the numeric value in beats per minute (e.g., 'heart rate of 110 bpm'). "
    "If the heart rate is indicated as elevated but no exact number is available, "
    "state it as 'heart rate >100 bpm'. Do not use vague phrases like "
    "'elevated heart rate' without a number or threshold."
)

PATIENT_SUMMARY_REFINEMENT_PROMPT = (
    "You are refining a patient-facing symptom summary. "
    "You are given the originally generated summary and the patient's requested "
    "edits/corrections. Produce one final paragraph in second-person voice, 3-5 "
    "sentences, that keeps clinically relevant details complete and accurate. "
    "Respect the patient's edits when they do not remove critical symptom facts. "
    "Do not include recommendations, triage levels, or next steps. "
    "Return only the final paragraph."
)


class AIClinicalSummaryService:
    """Service for generating AI-powered clinical narrative summaries."""

    def __init__(self) -> None:
        self._enabled = settings.ai_clinical_summary_enabled
        self._api_key = settings.gemini_api_key
        self._model_name = settings.gemini_model
        self._timeout_seconds = settings.gemini_timeout_seconds

    @property
    def is_available(self) -> bool:
        """True when AI generation is enabled and configured."""
        return bool(self._enabled and self._api_key)

    async def generate_clinical_summary(
        self,
        messages: List[MessageModel],
    ) -> Optional[str]:
        """
        Generate a physician-facing summary from the full chat transcript.

        Returns None on failure so caller can safely fallback.
        """
        if not self.is_available:
            logger.info(
                "Skipping Gemini clinical summary: "
                f"enabled={self._enabled}, has_api_key={bool(self._api_key)}"
            )
            return None

        transcript = self._format_transcript(messages)
        if not transcript:
            logger.warning(
                "Skipping Gemini clinical summary due to empty transcript"
            )
            return None

        logger.info(
            "Attempting Gemini clinical summary generation: "
            f"messages={len(messages)}, transcript_chars={len(transcript)}"
        )

        return await self._generate_with_prompt(
            prompt_text=DOCTOR_SUMMARY_PROMPT,
            transcript=transcript,
        )

    async def generate_patient_summary(
        self,
        messages: List[MessageModel],
    ) -> Optional[str]:
        """
        Generate a patient-facing summary from the full chat transcript.

        Returns None on failure so caller can safely fallback.
        """
        if not self.is_available:
            logger.info(
                "Skipping Gemini patient summary: "
                f"enabled={self._enabled}, has_api_key={bool(self._api_key)}"
            )
            return None

        transcript = self._format_transcript(messages)
        if not transcript:
            logger.warning(
                "Skipping Gemini patient summary due to empty transcript"
            )
            return None

        logger.info(
            "Attempting Gemini patient summary generation: "
            f"messages={len(messages)}, transcript_chars={len(transcript)}"
        )

        return await self._generate_with_prompt(
            prompt_text=PATIENT_SUMMARY_PROMPT,
            transcript=transcript,
        )

    async def generate_refined_patient_summary(
        self,
        original_summary: str,
        user_edited_summary: str,
    ) -> Optional[str]:
        """
        Generate a final patient-facing summary from original + user edits.

        Returns None on failure so caller can fallback safely.
        """
        if not self.is_available:
            logger.info(
                "Skipping Gemini patient summary refinement: "
                f"enabled={self._enabled}, has_api_key={bool(self._api_key)}"
            )
            return None

        original = (original_summary or "").strip()
        edited = (user_edited_summary or "").strip()
        if not original or not edited:
            logger.warning(
                "Skipping Gemini patient summary refinement due to missing inputs"
            )
            return None

        refinement_input = (
            f"{PATIENT_SUMMARY_REFINEMENT_PROMPT}\n\n"
            f"Original generated summary:\n{original}\n\n"
            f"Patient requested edits/additions:\n{edited}\n\n"
            "Return only the final refined paragraph."
        )

        try:
            raw_text = await asyncio.wait_for(
                asyncio.to_thread(self._generate_sync, refinement_input),
                timeout=self._timeout_seconds,
            )
        except asyncio.TimeoutError:
            logger.warning("Gemini patient summary refinement timed out")
            return None
        except Exception as exc:
            logger.error(f"Gemini patient summary refinement failed: {exc}")
            return None

        cleaned = self._normalize_output(raw_text)
        if not cleaned:
            logger.warning(
                "Gemini returned empty/invalid refined patient summary output"
            )
        return cleaned or None

    async def _generate_with_prompt(
        self,
        prompt_text: str,
        transcript: str,
    ) -> Optional[str]:
        """Shared AI generation runner for doctor/patient prompts."""
        final_prompt = (
            f"{prompt_text}\n\n"
            "Full chat sequence (chronological):\n"
            f"{transcript}\n\n"
            "Return only the final 3-5 sentence paragraph."
        )

        try:
            raw_text = await asyncio.wait_for(
                asyncio.to_thread(self._generate_sync, final_prompt),
                timeout=self._timeout_seconds,
            )
        except asyncio.TimeoutError:
            logger.warning("Gemini summary generation timed out")
            return None
        except Exception as exc:
            logger.error(f"Gemini summary generation failed: {exc}")
            return None

        cleaned = self._normalize_output(raw_text)
        if not cleaned:
            logger.warning(
                "Gemini returned empty/invalid summary output after normalization"
            )
        return cleaned or None

    def _generate_sync(self, prompt: str) -> str:
        """Run Gemini call in a sync context."""
        client = genai.Client(api_key=self._api_key)
        response = client.models.generate_content(
            model=self._model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                top_p=0.95,
            ),
        )
        return getattr(response, "text", "") or ""

    @staticmethod
    def _format_transcript(messages: List[MessageModel]) -> str:
        """Format full chat messages for prompt input."""
        lines: List[str] = []
        for msg in messages:
            sender = (msg.sender or "unknown").strip().upper()
            msg_type = (msg.message_type or "text").strip()
            content = (msg.content or "").strip()
            if not content:
                continue
            lines.append(f"{sender} [{msg_type}]: {content}")
        return "\n".join(lines)

    @staticmethod
    def _normalize_output(text: str) -> str:
        """
        Normalize model output to a clean paragraph.

        Removes markdown bullets/headings and compresses whitespace.
        """
        if not text:
            return ""
        cleaned = text.strip()
        cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
        cleaned = re.sub(r"^\s*[-*]\s+", "", cleaned, flags=re.MULTILINE)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        return cleaned
