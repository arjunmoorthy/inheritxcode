from db.models.conversation import SymptomDetail, SymptomTimeSeries
from core.logging import get_logger

logger = get_logger(__name__)


def save_symptom_analytics(db, patient_id, conversation_id, engine_state):
    """
    Persist symptom analytics to symptom_details and symptom_time_series.
    Uses keys from ConversationState.to_dict(): selected_symptoms, answers,
    triage_results, highest_triage_level (not severity/triage_level at top level).
    """
    selected_symptoms = engine_state.get("selected_symptoms", [])
    answers = engine_state.get("answers", {})
    symptom_answers = engine_state.get("symptom_answers", {}) or {}
    triage_results = engine_state.get("triage_results", [])

    # State uses highest_triage_level, not triage_level
    triage_level = engine_state.get("triage_level") or engine_state.get("highest_triage_level", "none")
    # Build severity per symptom from user answers (preferred) so dashboard reflects
    # what patient selected when asked for severity.
    def _normalize_severity(value):
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
        return mapping.get(v)

    def _extract_user_severity(symptom_id, symptom_dict):
        if not isinstance(symptom_dict, dict):
            return None
        # Common severity keys across symptom definitions
        for k in ("severity", "cough_severity", "severity_no_meds", "severity_post_meds", "severity_post_med"):
            sev = _normalize_severity(symptom_dict.get(k))
            if sev:
                return sev
        # APP-209 and CON-210 use `discomfort` as the severity-like input.
        if symptom_id in ("APP-209", "CON-210"):
            sev = _normalize_severity(symptom_dict.get("discomfort"))
            if sev:
                return sev
        # Some symptoms capture abdominal pain severity explicitly.
        sev = _normalize_severity(symptom_dict.get("abd_pain_sev"))
        if sev:
            return sev
        return None

    severity_map = {}
    if symptom_answers:
        for sid, a in symptom_answers.items():
            sev = _extract_user_severity(sid, a)
            if sev:
                severity_map[sid] = sev

    logger.info(
        "save_symptom_analytics: patient_id=%s conversation_id=%s selected_symptoms=%s triage_level=%s",
        patient_id, conversation_id, selected_symptoms, triage_level,
    )

    if not selected_symptoms:
        logger.warning("save_symptom_analytics: no selected_symptoms, skipping symptom_details insert")
    else:
        # 1️⃣ store symptom details
        for symptom in selected_symptoms:
            symptom_payload = (symptom_answers.get(symptom) if symptom_answers else None) or (answers or None)
            symptom_detail = SymptomDetail(
                patient_id=patient_id,
                conversation_id=conversation_id,
                symptom_id=symptom,
                severity=severity_map.get(symptom) if isinstance(severity_map.get(symptom), str) else None,
                triage_level=triage_level if isinstance(triage_level, str) else str(triage_level),
                # Prefer the per-symptom answers snapshot (if available); otherwise fall back to the
                # flat `answers` dict (which may only contain the last symptom's answers).
                answers_json=symptom_payload,
            )
            db.add(symptom_detail)

    # 2️⃣ store numeric metrics from answers
    #
    # Global rule:
    # - If we have per-symptom snapshots (`symptom_answers`), always attribute metrics to the
    #   symptom they were captured under. This avoids mis-attribution when question IDs don't
    #   include a symptom prefix (e.g. constipation uses `days_bm`).
    # - Only if we *don't* have per-symptom snapshots, fall back to inferring symptom_id from
    #   metric_name (legacy `answers` dict).
    metrics_source = symptom_answers if symptom_answers else ({"__flat__": answers} if answers else {})
    if selected_symptoms and metrics_source:
        def _metric_symptom_id(metric_name: str) -> str:
            """
            Determine which symptom a metric belongs to.

            NOTE: ConversationState currently keeps a flat `answers` dict which may contain
            keys from the last assessed symptom (engine resets answers per symptom).
            We therefore infer the symptom_id from the metric name rather than always
            attributing it to `selected_symptoms[0]`.
            """
            # Fever metrics (do not use prefix because fever uses plain `temp`)
            if (
                metric_name == "temp"
                or metric_name.startswith("fever_")
                or metric_name.startswith("high_temp_")
            ):
                if "FEV-202" in selected_symptoms:
                    return "FEV-202"

            # Prefix-based mapping for symptom-specific question IDs (e.g. cough_temp, vom_hr, dia_days)
            prefix = metric_name.split("_", 1)[0] if metric_name else ""
            prefix_map = {
                "cough": "COU-215",
                "vom": "VOM-204",
                "dia": "DIA-205",
                "nau": "NAU-203",
                "deh": "DEH-201",
                "mso": "MSO-208",
                "abd": "ABD-211",
                "pai": "PAI-213",
                "hea": "HEA-210",
                "neu": "NEU-216",
                "uri": "URI-211",
                "fat": "FAT-206",
            }
            mapped = prefix_map.get(prefix)
            if mapped and mapped in selected_symptoms:
                return mapped

            # Fallback: keep previous behavior for unknown metrics
            return selected_symptoms[0]

        for symptom_id, symptom_dict in metrics_source.items():
            if not isinstance(symptom_dict, dict):
                continue
            for key, value in symptom_dict.items():
                # Skip booleans (bool is a subclass of int) — time series is intended for numeric vitals/quantities.
                if isinstance(value, bool):
                    continue
                if isinstance(value, (int, float)):
                    metric_row = SymptomTimeSeries(
                        patient_id=patient_id,
                        conversation_id=conversation_id,
                        symptom_id=symptom_id if symptom_answers else _metric_symptom_id(key),
                        # Previous behavior (kept for reference):
                        # symptom_id=selected_symptoms[0],
                        metric_name=key,
                        metric_value=float(value),
                    )
                    db.add(metric_row)

    db.commit()
    logger.info("save_symptom_analytics: committed %d symptom_details, metrics from answers", len(selected_symptoms))