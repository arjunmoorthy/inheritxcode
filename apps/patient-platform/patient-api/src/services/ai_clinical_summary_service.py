"""
AI Clinical Summary Service.

Generates physician-facing clinical narrative summaries from the full chat
transcript using Gemini. Falls back to deterministic summary generation in the
caller when unavailable or on errors.
"""

import asyncio
import re
import time
from typing import Any, Dict, List, Optional

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

# Max characters to send to Gemini in the prompt (includes instruction + transcript).
# Keep conservative default; can be overridden with settings.gemini_max_prompt_chars
DEFAULT_MAX_PROMPT_CHARS = 9000
DEFAULT_MAX_OUTPUT_TOKENS = 512
DEFAULT_REQUEST_TIMEOUT_SECONDS = 45
TRIM_PREFIX = "[...truncated older messages...]\n"
TRANSIENT_GEMINI_ERROR_MARKERS = (
    "503",
    "unavailable",
    "deadline exceeded",
    "timed out",
    "timeout",
    "connection reset",
    "temporarily",
    "internal",
    "500",
    "429",
    "resource exhausted",
)


class AIClinicalSummaryService:
    """Service for generating AI-powered clinical narrative summaries."""

    def __init__(self) -> None:
        self._enabled = settings.ai_clinical_summary_enabled
        self._api_key = settings.gemini_api_key
        self._model_name = settings.gemini_model
        configured_timeout = int(settings.gemini_timeout_seconds)
        hard_cap_timeout = int(getattr(settings, "gemini_hard_timeout_seconds", 60))
        # Prevent very high runtime latency from blocking symptom-check completion.
        self._timeout_seconds = max(5, min(configured_timeout, hard_cap_timeout))
        # Retry only for transient provider/network failures.
        self._max_retries = int(getattr(settings, "gemini_max_retries", 2))
        self._retry_base_delay_seconds = float(
            getattr(settings, "gemini_retry_base_delay_seconds", 1.5)
        )
        self._request_timeout_seconds = max(
            5,
            int(
                getattr(
                    settings,
                    "gemini_request_timeout_seconds",
                    min(DEFAULT_REQUEST_TIMEOUT_SECONDS, self._timeout_seconds),
                )
            ),
        )
        self._max_output_tokens = max(
            128,
            int(getattr(settings, "gemini_max_output_tokens", DEFAULT_MAX_OUTPUT_TOKENS)),
        )
        # Lazily create a reusable client for the lifetime of this service instance.
        # Creating a new client per request can add noticeable overhead.
        self._client = genai.Client(api_key=self._api_key) if self._api_key else None
        # Allow configuration override from settings if present
        self._max_prompt_chars = getattr(settings, "gemini_max_prompt_chars", DEFAULT_MAX_PROMPT_CHARS)

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
            logger.warning(
                "Gemini patient summary refinement timed out: model=%s app_timeout_seconds=%s prompt_chars=%d",
                self._model_name,
                self._timeout_seconds,
                len(refinement_input),
            )
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
        # If transcript + prompt is too large, trim oldest content first and add a
        # visible prefix so the model understands older context was removed.
        prompt_header = f"{prompt_text}\n\nFull chat sequence (chronological):\n"
        footer = "\n\nReturn only the final 3-5 sentence paragraph."

        # compute allowed transcript size
        allowed = max(0, self._max_prompt_chars - len(prompt_header) - len(footer))
        used_transcript = transcript
        trimmed = False
        if len(transcript) > allowed:
            # Keep the most recent characters up to allowed, prefixed with TRIM_PREFIX
            used_transcript = TRIM_PREFIX + transcript[-max(0, allowed - len(TRIM_PREFIX)):]
            trimmed = True

        final_prompt = f"{prompt_header}{used_transcript}{footer}"

        if trimmed:
            logger.info(
                "Trimmed transcript for Gemini generation: original_chars=%d, allowed=%d, final_chars=%d",
                len(transcript), allowed, len(used_transcript),
            )

        try:
            logger.info(
                "Sending prompt to Gemini: model=%s prompt_chars=%d",
                self._model_name, len(final_prompt),
            )

            raw_text = await asyncio.wait_for(
                asyncio.to_thread(self._generate_sync, final_prompt),
                timeout=self._timeout_seconds,
            )
        except asyncio.TimeoutError:
            logger.warning(
                "Gemini summary generation timed out: model=%s app_timeout_seconds=%s prompt_chars=%d",
                self._model_name,
                self._timeout_seconds,
                len(final_prompt),
            )
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
        # Reuse client if available to avoid repeated client initialization overhead.
        if not self._client:
            self._client = genai.Client(api_key=self._api_key)
        generation_config = self._build_generation_config()
        attempt = 0
        max_attempts = max(1, self._max_retries + 1)
        while attempt < max_attempts:
            attempt += 1
            start = time.monotonic()
            try:
                response = self._client.models.generate_content(
                    model=self._model_name,
                    contents=prompt,
                    config=generation_config,
                )
                duration = time.monotonic() - start
                text = getattr(response, "text", "") or ""
                logger.info(
                    "Gemini call completed: model=%s attempt=%d duration=%.3fs response_chars=%d",
                    self._model_name,
                    attempt,
                    duration,
                    len(text),
                )
                return text
            except Exception as exc:
                if attempt >= max_attempts or not self._is_transient_error(exc):
                    raise

                delay = self._retry_base_delay_seconds * (2 ** (attempt - 1))
                logger.warning(
                    "Gemini transient failure; retrying: model=%s attempt=%d/%d delay=%.1fs error=%s",
                    self._model_name,
                    attempt,
                    max_attempts,
                    delay,
                    exc,
                )
                time.sleep(delay)

        return ""

    def _build_generation_config(self) -> types.GenerateContentConfig:
        """
        Build a low-latency Gemini generation config for short summary text.

        These prompts are plain text summarization requests and do not require
        tools/function calling. Disabling automatic function calling avoids the
        SDK's default "AFC is enabled with max remote calls: 10" path observed in
        timeout logs. Output and thinking budgets are capped because callers ask
        for only a 3-5 sentence paragraph.
        """
        config_kwargs: Dict[str, Any] = {
            "temperature": 0.2,
            "top_p": 0.95,
            "max_output_tokens": self._max_output_tokens,
            # SDK versions that use http_options honor this as a provider-side
            # deadline; older versions ignore unsupported fields through the
            # fallback constructor path below.
            "http_options": types.HttpOptions(
                timeout=int(self._request_timeout_seconds * 1000)
            ),
        }

        automatic_function_calling_config = getattr(
            types,
            "AutomaticFunctionCallingConfig",
            None,
        )
        if automatic_function_calling_config:
            config_kwargs["automatic_function_calling"] = (
                automatic_function_calling_config(disable=True)
            )

        thinking_config = getattr(types, "ThinkingConfig", None)
        if thinking_config:
            try:
                config_kwargs["thinking_config"] = thinking_config(thinking_budget=0)
            except TypeError:
                # Some SDK/model combinations do not expose configurable
                # thinking. The rest of the latency controls still apply.
                logger.debug("Gemini ThinkingConfig does not support thinking_budget=0")

        try:
            return types.GenerateContentConfig(**config_kwargs)
        except TypeError as exc:
            logger.warning(
                "Gemini SDK rejected one or more low-latency config fields; "
                "falling back to portable generation config: %s",
                exc,
            )
            return types.GenerateContentConfig(
                temperature=0.2,
                top_p=0.95,
                max_output_tokens=self._max_output_tokens,
            )

    @staticmethod
    def _is_transient_error(exc: Exception) -> bool:
        """Best-effort classifier for retryable Gemini/network failures."""
        text = str(exc).lower()
        return any(marker in text for marker in TRANSIENT_GEMINI_ERROR_MARKERS)

    @staticmethod
    def _format_transcript(messages: List[MessageModel]) -> str:
        """
        Format chat messages for prompt input.

        Keep the transcript compact by prioritizing patient-provided content.
        Including every assistant prompt (questions/options/instructions) makes
        long symptom sessions much slower and increases timeout risk.
        """
        lines: List[str] = []
        for msg in messages:
            sender_raw = (msg.sender or "unknown").strip().lower()
            # Only patient inputs are required for symptom summarization.
            # Skip assistant/system messages to keep prompt size and latency low.
            if sender_raw != "user":
                continue

            sender = sender_raw.upper()
            msg_type = (msg.message_type or "text").strip()
            content = (msg.content or "").strip()
            if not content:
                continue
            # Keep each user entry bounded so unusually verbose notes do not
            # dominate the prompt and trigger model timeouts.
            if len(content) > 500:
                content = content[:500] + "..."
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
