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
from routers.chat.symptom_checker.constants import InputType
from routers.chat.symptom_checker.symptom_definitions import (
    Question,
    SymptomDef,
    get_symptom_by_id,
)

logger = get_logger(__name__)


DOCTOR_SUMMARY_PROMPT = (
    "Summarize the patient's symptom report into a single physician-facing "
    "paragraph using ONLY the assessment data below. Include every symptom "
    "the patient reported with severity, duration, interventions tried, "
    "response, and associated features when those details are explicitly "
    "present. Mention oral intake, hydration, ADLs, temperature, weight "
    "changes, or other findings ONLY when explicitly answered. If a question "
    "was answered No or denied, do not describe that finding as present. Do "
    "not invent symptoms, temperatures, heart rates, dates, or associated "
    "features that are not in the assessment data. Do not infer or assign "
    "causality unless explicitly stated. Mention chemotherapy dates ONLY if "
    "they appear in the Chemotherapy check-in section below; never attribute "
    "symptom onset, timing, or severity to chemotherapy unless the patient "
    "explicitly stated that relationship. Write in neutral clinical language "
    "in 3-5 sentences without recommendations, triage levels, or next steps. "
    "If emergent symptoms were reported, mention them first."

    "Normalize abbreviations into proper clinical terminology (e.g., 'hr' to "
    "'heart rate'). Include a numeric heart rate only when a number is "
    "explicitly provided."
)

PATIENT_SUMMARY_PROMPT = (
    "Summarize the patient's symptom report into a single patient-facing "
    "paragraph in second-person voice using ONLY the assessment data below. "
    "Include symptoms, severity, duration, interventions tried, response, and "
    "associated features only when explicitly present. Mention oral intake, "
    "hydration, daily activity impact, temperature, weight changes, or other "
    "findings ONLY when explicitly answered. If a question was answered No or "
    "denied, do not describe that finding as present. Do not invent symptoms, "
    "temperatures, heart rates, dates, or associated features that are not in "
    "the assessment data. Mention chemotherapy dates ONLY if they appear in "
    "the Chemotherapy check-in section below; never attribute symptom onset, "
    "timing, or severity to chemotherapy unless the patient explicitly stated "
    "that relationship. Use clear and simple language in 3-5 sentences. Do "
    "not include recommendations, triage levels, or next steps."

    "Normalize abbreviations into proper clinical terminology (e.g., 'hr' to "
    "'heart rate'). Include a numeric heart rate only when a number is "
    "explicitly provided."
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
        engine_state: Optional[Dict[str, Any]] = None,
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

        transcript = self._build_assessment_transcript(messages, engine_state)
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
        engine_state: Optional[Dict[str, Any]] = None,
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

        transcript = self._build_assessment_transcript(messages, engine_state)
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
        prompt_header = f"{prompt_text}\n\nAssessment data (authoritative):\n"
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
        logger.info(
            "Gemini request payload start (trimmed=%s, transcript_chars=%d, prompt_chars=%d)\n%s\nGemini request payload end",
            trimmed,
            len(used_transcript),
            len(final_prompt),
            final_prompt,
        )

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
    def _build_assessment_transcript(
        messages: List[MessageModel],
        engine_state: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Build labeled assessment data for Gemini.

        Combines question/answer pairs from the chat thread with structured
        symptom answers from engine_state so yes/no responses keep context.
        """
        sections: List[str] = []

        context = AIClinicalSummaryService._format_session_context(engine_state)
        if context:
            sections.append("Session context:\n" + context)

        chemo_qa, symptom_qa = AIClinicalSummaryService._split_question_answer_pairs(
            messages
        )
        if chemo_qa:
            sections.append("Chemotherapy check-in (this session):\n" + chemo_qa)
        if symptom_qa:
            sections.append("Symptom assessment:\n" + symptom_qa)

        structured = AIClinicalSummaryService._format_structured_symptom_answers(
            engine_state
        )
        if structured:
            sections.append("Structured symptom answers:\n" + structured)

        return "\n\n".join(sections).strip()

    @staticmethod
    def _format_session_context(engine_state: Optional[Dict[str, Any]]) -> str:
        if not engine_state:
            return ""

        lines: List[str] = []
        # Chemotherapy dates are intentionally omitted here. They are only sent
        # to Gemini when the chemo check-in questions were asked in this session
        # (see Chemotherapy check-in section built from message Q&A pairs).

        selected = engine_state.get("selected_symptoms") or []
        if selected:
            names = []
            for symptom_id in selected:
                symptom = get_symptom_by_id(symptom_id)
                names.append(symptom.name if symptom else str(symptom_id))
            lines.append(f"- Symptoms selected: {', '.join(names)}")

        temperature = engine_state.get("session_temperature")
        if temperature is not None:
            lines.append(f"- Recorded temperature: {temperature}")

        notes = engine_state.get("personal_notes")
        if notes and str(notes).strip():
            lines.append(f"- Personal notes: {str(notes).strip()}")

        return "\n".join(lines)

    @staticmethod
    def _split_question_answer_pairs(
        messages: List[MessageModel],
    ) -> tuple[str, str]:
        chemo_lines: List[str] = []
        symptom_lines: List[str] = []
        pending_question: Optional[str] = None
        pending_is_chemo = False

        for msg in messages:
            sender = (msg.sender or "").strip().lower()
            if AIClinicalSummaryService._should_use_as_question(msg):
                pending_question = AIClinicalSummaryService._clean_question_text(
                    msg.content or ""
                )
                pending_is_chemo = AIClinicalSummaryService._is_chemo_question(msg)
                continue

            if sender != "user":
                continue

            answer = AIClinicalSummaryService._format_user_answer(msg)
            if not answer:
                continue

            if pending_question:
                line = f"Q: {pending_question}\nA: {answer}"
                if pending_is_chemo or AIClinicalSummaryService._is_chemo_answer(
                    pending_question, answer
                ):
                    chemo_lines.append(line)
                else:
                    symptom_lines.append(line)
                pending_question = None
                pending_is_chemo = False
            else:
                symptom_lines.append(f"A: {answer}")

        return "\n\n".join(chemo_lines), "\n\n".join(symptom_lines)

    @staticmethod
    def _is_chemo_question(msg: MessageModel) -> bool:
        structured = msg.structured_data or {}
        frontend_type = (
            structured.get("frontend_type") or msg.message_type or ""
        ).strip().lower()
        if frontend_type in {"chemo_today_check", "next_chemo_date"}:
            return True

        content = (msg.content or "").lower()
        return any(
            phrase in content
            for phrase in (
                "chemotherapy today",
                "last chemotherapy",
                "next chemotherapy",
                "chemo today",
            )
        )

    @staticmethod
    def _is_chemo_answer(question: str, answer: str) -> bool:
        if AIClinicalSummaryService._looks_like_iso_date(answer):
            question_lower = question.lower()
            return "chemotherapy" in question_lower or "chemo" in question_lower
        return False

    @staticmethod
    def _looks_like_iso_date(value: str) -> bool:
        return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", (value or "").strip()))

    @staticmethod
    def _format_question_answer_pairs(messages: List[MessageModel]) -> str:
        chemo_qa, symptom_qa = AIClinicalSummaryService._split_question_answer_pairs(
            messages
        )
        sections = [section for section in (chemo_qa, symptom_qa) if section]
        return "\n\n".join(sections)

    @staticmethod
    def _should_use_as_question(msg: MessageModel) -> bool:
        sender = (msg.sender or "").strip().lower()
        if sender not in ("assistant", "ruby", "system"):
            return False

        structured = msg.structured_data or {}
        frontend_type = (
            structured.get("frontend_type") or msg.message_type or ""
        ).strip().lower()
        if frontend_type in {
            "summary",
            "education",
            "download",
            "image",
            "text_input",
        }:
            return False

        content = (msg.content or "").strip()
        if not content:
            return False

        lowered = content.lower()
        if any(
            marker in lowered
            for marker in (
                "assessment complete",
                "great to hear you're feeling fine",
                "saved to your summaries",
                "here is some helpful information",
            )
        ):
            return False

        if frontend_type in {
            "disclaimer",
            "chemo_today_check",
            "next_chemo_date",
            "emergency_check",
            "emergency-check",
            "symptom_select",
            "symptom-select",
            "yes_no",
            "single-select",
            "single_select",
            "choice",
            "multi-select",
            "multi_select",
            "multiselect",
            "number",
            "patient_context",
        }:
            return True

        return "?" in content

    @staticmethod
    def _clean_question_text(text: str) -> str:
        cleaned = re.sub(r"\*\*(.*?)\*\*", r"\1", text or "")
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        if len(cleaned) > 500:
            cleaned = cleaned[:500] + "..."
        return cleaned

    @staticmethod
    def _format_user_answer(msg: MessageModel) -> str:
        content = (msg.content or "").strip()
        if not content:
            return ""

        workflow_labels = {
            "accept": "Accepted medical disclaimer",
            "no_edit_summary": "No edits requested before summary generation",
            "done": "Marked session complete",
            "report_another": "Requested to report another symptom",
            "save_diary": "Saved to diary",
            "download": "Downloaded summary",
        }
        if content in workflow_labels:
            return workflow_labels[content]

        lowered = content.lower()
        if lowered in {"yes", "true"}:
            return "Yes"
        if lowered in {"no", "false"}:
            return "No"
        if lowered == "none":
            return "None of the above"

        if len(content) > 500:
            content = content[:500] + "..."
        return content

    @staticmethod
    def _format_structured_symptom_answers(
        engine_state: Optional[Dict[str, Any]],
    ) -> str:
        if not engine_state:
            return ""

        symptom_answers: Dict[str, Dict[str, Any]] = (
            engine_state.get("symptom_answers") or {}
        )
        if not symptom_answers:
            return ""

        sections: List[str] = []
        completed = engine_state.get("completed_symptoms") or []
        selected = engine_state.get("selected_symptoms") or []
        order = completed if completed else selected

        for symptom_id in order:
            answers = symptom_answers.get(symptom_id) or {}
            if not answers:
                continue

            symptom = get_symptom_by_id(symptom_id)
            symptom_name = symptom.name if symptom else str(symptom_id)
            lines = AIClinicalSummaryService._format_symptom_answer_lines(
                symptom, answers
            )
            if not lines:
                continue
            sections.append(f"{symptom_name}:\n" + "\n".join(lines))

        return "\n\n".join(sections)

    @staticmethod
    def _format_symptom_answer_lines(
        symptom: Optional[SymptomDef],
        answers: Dict[str, Any],
    ) -> List[str]:
        if not answers:
            return []

        lines: List[str] = []
        questions: List[Question] = []
        if symptom:
            seen: set[str] = set()
            for question in symptom.screening_questions + symptom.follow_up_questions:
                if question.id in seen:
                    continue
                seen.add(question.id)
                questions.append(question)

        question_by_id = {question.id: question for question in questions}
        for question in questions:
            if question.id not in answers:
                continue
            formatted = AIClinicalSummaryService._format_answer_value(
                question, answers[question.id]
            )
            if formatted:
                lines.append(f"- {question.text}: {formatted}")

        for key, value in sorted(answers.items()):
            if value is None or value == "" or value == []:
                continue
            if key in question_by_id:
                continue
            lines.append(
                f"- {key.replace('_', ' ')}: "
                f"{AIClinicalSummaryService._stringify_value(value)}"
            )

        return lines

    @staticmethod
    def _format_answer_value(question: Question, value: Any) -> Optional[str]:
        input_type = question.input_type
        if isinstance(input_type, str):
            try:
                input_type = InputType(input_type)
            except ValueError:
                pass

        if input_type == InputType.YES_NO:
            if isinstance(value, bool):
                return "Yes" if value else "No"
            lowered = str(value).strip().lower()
            if lowered in {"yes", "true"}:
                return "Yes"
            if lowered in {"no", "false"}:
                return "No"

        if input_type in (InputType.CHOICE, InputType.MULTISELECT):
            if isinstance(value, list):
                labels = AIClinicalSummaryService._choice_labels(question, value)
                return labels or AIClinicalSummaryService._stringify_value(value)
            label = AIClinicalSummaryService._choice_label(question, value)
            return label or AIClinicalSummaryService._stringify_value(value)

        if input_type == InputType.NUMBER:
            return AIClinicalSummaryService._stringify_value(value)

        if input_type == InputType.TEXT:
            text = AIClinicalSummaryService._stringify_value(value)
            return text if text else None

        return AIClinicalSummaryService._stringify_value(value)

    @staticmethod
    def _choice_label(question: Question, value: Any) -> Optional[str]:
        for option in question.options:
            if option.value == value or str(option.value) == str(value):
                return (option.label or str(value)).strip()
        return None

    @staticmethod
    def _choice_labels(question: Question, values: List[Any]) -> Optional[str]:
        labels: List[str] = []
        for raw in values:
            if raw in (None, "", "none"):
                if raw == "none":
                    labels.append("None of the above")
                continue
            label = AIClinicalSummaryService._choice_label(question, raw)
            labels.append(label or str(raw))
        if not labels:
            return None
        return ", ".join(labels)

    @staticmethod
    def _stringify_value(value: Any) -> str:
        if isinstance(value, bool):
            return "Yes" if value else "No"
        if isinstance(value, list):
            return ", ".join(str(item) for item in value if item not in (None, ""))
        return str(value).strip()

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
